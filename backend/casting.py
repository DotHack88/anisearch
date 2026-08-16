"""
AniSearch — DLNA/UPnP Smart TV Casting
Supports: Samsung, LG, Sony, Philips, Fire Stick (with AirScreen), any DLNA renderer.

Works only when the backend runs on the same LAN as the TV.
"""

import asyncio
import logging
import socket
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()

# ─── SSDP constants ──────────────────────────────────────────────────────────
SSDP_ADDR = "239.255.255.250"
SSDP_PORT = 1900
SSDP_ST_RENDERER = "urn:schemas-upnp-org:device:MediaRenderer:1"
SSDP_MX = 3  # seconds to wait for responses

SSDP_MSEARCH = (
    "M-SEARCH * HTTP/1.1\r\n"
    f"HOST: {SSDP_ADDR}:{SSDP_PORT}\r\n"
    "MAN: \"ssdp:discover\"\r\n"
    f"MX: {SSDP_MX}\r\n"
    f"ST: {SSDP_ST_RENDERER}\r\n"
    "\r\n"
)

# ─── Pydantic models ──────────────────────────────────────────────────────────

class CastPlayRequest(BaseModel):
    device_url: str           # UPnP device description URL, e.g. http://192.168.1.5:49152/description.xml
    video_url: str            # Public HTTP URL of the video stream
    title: str = "Video"
    image_url: str = ""

class CastCommandRequest(BaseModel):
    device_url: str

# ─── SSDP Discovery ──────────────────────────────────────────────────────────

async def _ssdp_discover(timeout: float = 4.0) -> list[dict[str, str]]:
    """
    Send an SSDP M-SEARCH multicast and collect MediaRenderer responses.
    Returns a list of {location} dicts (the raw UPnP description URLs).
    """
    loop = asyncio.get_event_loop()
    found: dict[str, str] = {}  # location -> raw response

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.setsockopt(socket.IPPROTO_IP, socket.IP_MULTICAST_TTL, 4)
    sock.settimeout(0.1)
    try:
        # Send standard MediaRenderer search
        sock.sendto(SSDP_MSEARCH.encode(), (SSDP_ADDR, SSDP_PORT))
        # Samsung Tizen TVs sometimes only respond to rootdevice or ssdp:all
        msearch_root = SSDP_MSEARCH.replace(SSDP_ST_RENDERER, "upnp:rootdevice")
        sock.sendto(msearch_root.encode(), (SSDP_ADDR, SSDP_PORT))
    except Exception as e:
        logger.warning(f"SSDP send failed: {e}")
        sock.close()
        return []

    deadline = loop.time() + timeout
    while loop.time() < deadline:
        try:
            data, addr = await loop.run_in_executor(None, lambda: sock.recvfrom(4096))
            text = data.decode(errors="ignore")
            # Extract LOCATION header
            location = None
            for line in text.splitlines():
                if line.lower().startswith("location:"):
                    location = line.split(":", 1)[1].strip()
                    break
            if location and location not in found:
                found[location] = text
        except socket.timeout:
            await asyncio.sleep(0.05)
        except Exception:
            await asyncio.sleep(0.05)

    sock.close()
    return [{"location": loc, "raw": raw} for loc, raw in found.items()]


async def _fetch_device_info(location: str) -> dict[str, Any] | None:
    """
    Fetch and parse the UPnP device description XML at `location`.
    Returns a dict with name, model, manufacturer, av_transport_url, etc.
    """
    import xml.etree.ElementTree as ET
    try:
        import httpx
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(location)
            if resp.status_code != 200:
                return None
            xml_text = resp.text
    except Exception as e:
        logger.debug(f"Failed to fetch device info from {location}: {e}")
        return None

    try:
        ns = {"d": "urn:schemas-upnp-org:device-1-0"}
        root = ET.fromstring(xml_text)

        def find_text(tag: str) -> str:
            el = root.find(f".//d:{tag}", ns)
            return el.text.strip() if el is not None and el.text else ""

        friendly_name = find_text("friendlyName") or find_text("modelName") or "Smart TV"
        model = find_text("modelName")
        manufacturer = find_text("manufacturer")

        # Find AVTransport controlURL
        av_transport_url = None
        base_url = location.rsplit("/", 1)[0] if "/" in location else location
        # Strip path to get scheme://host:port
        from urllib.parse import urlparse
        parsed = urlparse(location)
        base = f"{parsed.scheme}://{parsed.netloc}"

        for service in root.findall(".//d:service", ns):
            service_type = (service.findtext("d:serviceType", "", ns) or "").strip()
            if "AVTransport" in service_type:
                ctrl = (service.findtext("d:controlURL", "", ns) or "").strip()
                if ctrl:
                    av_transport_url = base + ctrl if not ctrl.startswith("http") else ctrl
                    break

        if not av_transport_url:
            return None  # Not a media renderer we can control

        # Detect device type from manufacturer/model for icon
        device_type = _detect_device_type(manufacturer, model, friendly_name)

        return {
            "id": location,
            "name": friendly_name,
            "model": model,
            "manufacturer": manufacturer,
            "type": device_type,
            "device_url": location,
            "av_transport_url": av_transport_url,
        }
    except Exception as e:
        logger.debug(f"Failed to parse device XML from {location}: {e}")
        return None


def _detect_device_type(manufacturer: str, model: str, name: str) -> str:
    """Detect device brand/type for frontend icon rendering."""
    combined = f"{manufacturer} {model} {name}".lower()
    if "samsung" in combined:
        return "samsung"
    if "lg" in combined:
        return "lg"
    if "sony" in combined:
        return "sony"
    if "philips" in combined:
        return "philips"
    if "amazon" in combined or "fire" in combined:
        return "fire"
    if "apple" in combined:
        return "apple"
    if "roku" in combined:
        return "roku"
    return "tv"


# ─── UPnP AVTransport SOAP ───────────────────────────────────────────────────

_SOAP_ENVELOPE = """<?xml version="1.0"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"
            s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    {body}
  </s:Body>
</s:Envelope>"""

_SOAP_SET_URI = """<u:SetAVTransportURI xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">
      <InstanceID>0</InstanceID>
      <CurrentURI>{video_url}</CurrentURI>
      <CurrentURIMetaData>{metadata}</CurrentURIMetaData>
    </u:SetAVTransportURI>"""

_SOAP_PLAY = """<u:Play xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">
      <InstanceID>0</InstanceID>
      <Speed>1</Speed>
    </u:Play>"""

_SOAP_PAUSE = """<u:Pause xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">
      <InstanceID>0</InstanceID>
    </u:Pause>"""

_SOAP_STOP = """<u:Stop xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">
      <InstanceID>0</InstanceID>
    </u:Stop>"""

_SOAP_GET_STATUS = """<u:GetTransportInfo xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">
      <InstanceID>0</InstanceID>
    </u:GetTransportInfo>"""


def _build_didl(video_url: str, title: str, image_url: str) -> str:
    """Build a minimal DIDL-Lite metadata XML for AVTransport."""
    img_tag = f'<upnp:albumArtURI>{image_url}</upnp:albumArtURI>' if image_url else ""
    return (
        '&lt;DIDL-Lite xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/" '
        'xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/" '
        'xmlns:dc="http://purl.org/dc/elements/1.1/"&gt;'
        f'&lt;item id="0" parentID="-1" restricted="0"&gt;'
        f'&lt;dc:title&gt;{title}&lt;/dc:title&gt;'
        f'&lt;upnp:class&gt;object.item.videoItem&lt;/upnp:class&gt;'
        f'{img_tag}'
        f'&lt;res protocolInfo="http-get:*:video/mp4:*"&gt;{video_url}&lt;/res&gt;'
        f'&lt;/item&gt;&lt;/DIDL-Lite&gt;'
    )


async def _soap_action(control_url: str, action: str, body: str) -> str:
    """Send a UPnP SOAP request to the TV control URL."""
    import httpx
    envelope = _SOAP_ENVELOPE.format(body=body)
    headers = {
        "Content-Type": 'text/xml; charset="utf-8"',
        "SOAPAction": f'"urn:schemas-upnp-org:service:AVTransport:1#{action}"',
    }
    async with httpx.AsyncClient(timeout=5.0) as client:
        resp = await client.post(control_url, content=envelope.encode(), headers=headers)
        return resp.text


# Cache discovered devices so we don't re-scan on every play command
_device_cache: dict[str, dict] = {}  # device_url -> device info


# ─── API Endpoints ────────────────────────────────────────────────────────────

@router.get("/devices")
async def get_cast_devices():
    """
    Scan the local network via SSDP and return all found DLNA MediaRenderer devices.
    Works only when this backend runs on the same LAN as the TVs.
    """
    global _device_cache
    try:
        ssdp_results = await _ssdp_discover(timeout=4.0)
    except Exception as e:
        logger.error(f"SSDP discovery failed: {e}")
        raise HTTPException(status_code=503, detail="Discovery SSDP fallita. Verifica la connessione di rete.")

    # Fetch device info in parallel
    tasks = [_fetch_device_info(r["location"]) for r in ssdp_results]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    devices = []
    for info in results:
        if isinstance(info, dict) and info:
            _device_cache[info["device_url"]] = info
            devices.append({
                "id": info["device_url"],
                "name": info["name"],
                "model": info["model"],
                "manufacturer": info["manufacturer"],
                "type": info["type"],
                "device_url": info["device_url"],
                "av_transport_url": info["av_transport_url"],
            })

    return {"devices": devices, "count": len(devices)}


@router.post("/play")
async def cast_play(req: CastPlayRequest):
    """
    Start playing a video on a DLNA device.
    Sends SetAVTransportURI + Play UPnP commands.
    """
    # Try to get av_transport_url from cache or re-fetch
    device_info = _device_cache.get(req.device_url)
    if not device_info:
        device_info = await _fetch_device_info(req.device_url)
        if not device_info:
            raise HTTPException(status_code=404, detail="Dispositivo non trovato o non raggiungibile.")
        _device_cache[req.device_url] = device_info

    av_url = device_info["av_transport_url"]

    try:
        # Step 1: Set the media URI
        metadata = _build_didl(req.video_url, req.title, req.image_url)
        set_body = _SOAP_SET_URI.format(
            video_url=req.video_url.replace("&", "&amp;"),
            metadata=metadata
        )
        await _soap_action(av_url, "SetAVTransportURI", set_body)

        # Step 2: Play
        await asyncio.sleep(0.3)  # small delay for TV to buffer
        await _soap_action(av_url, "Play", _SOAP_PLAY)

        return {
            "ok": True,
            "device_name": device_info["name"],
            "message": f"Riproduzione avviata su {device_info['name']}"
        }
    except Exception as e:
        logger.error(f"Cast play failed: {e}")
        raise HTTPException(status_code=502, detail=f"Impossibile avviare la riproduzione: {e}")


@router.post("/pause")
async def cast_pause(req: CastCommandRequest):
    """Send Pause to the DLNA device."""
    device_info = _device_cache.get(req.device_url)
    if not device_info:
        raise HTTPException(status_code=404, detail="Dispositivo non in cache. Avvia prima la riproduzione.")

    try:
        await _soap_action(device_info["av_transport_url"], "Pause", _SOAP_PAUSE)
        return {"ok": True, "message": "Pausa inviata"}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Impossibile mettere in pausa: {e}")


@router.post("/stop")
async def cast_stop(req: CastCommandRequest):
    """Send Stop to the DLNA device."""
    device_info = _device_cache.get(req.device_url)
    if not device_info:
        raise HTTPException(status_code=404, detail="Dispositivo non in cache. Avvia prima la riproduzione.")

    try:
        await _soap_action(device_info["av_transport_url"], "Stop", _SOAP_STOP)
        return {"ok": True, "message": "Riproduzione interrotta"}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Impossibile fermare la riproduzione: {e}")


@router.get("/status")
async def cast_status(device_url: str):
    """
    Query the current transport state from a DLNA device.
    Returns state: PLAYING, PAUSED_PLAYBACK, STOPPED, etc.
    """
    device_info = _device_cache.get(device_url)
    if not device_info:
        return {"state": "UNKNOWN", "available": False}

    try:
        import xml.etree.ElementTree as ET
        response = await _soap_action(
            device_info["av_transport_url"], "GetTransportInfo", _SOAP_GET_STATUS
        )
        root = ET.fromstring(response)
        state_el = root.find(".//{urn:schemas-upnp-org:service:AVTransport:1}CurrentTransportState")
        state = state_el.text if state_el is not None else "UNKNOWN"
        return {"state": state, "available": True, "device_name": device_info["name"]}
    except Exception:
        return {"state": "UNKNOWN", "available": False}
