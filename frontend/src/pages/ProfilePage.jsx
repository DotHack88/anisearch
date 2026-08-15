import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { FiUser, FiMail, FiLock, FiImage, FiSave, FiAlertCircle, FiCheckCircle, FiUpload } from 'react-icons/fi';
import ImageCropper from '../components/ImageCropper';
import { uploadAvatar } from '../utils/api';

export default function ProfilePage() {
  const { user, updateProfile } = useAuth();
  
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [password, setPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Avatar upload & crop
  const [rawImageSrc, setRawImageSrc] = useState(null);
  const [showCropper, setShowCropper] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const fileInputRef = useRef(null);

  if (!user) {
    return (
      <div className="flex justify-center items-center h-64 text-text-dim font-body">
        Devi effettuare l'accesso per visualizzare il tuo profilo.
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const data = {};
    if (username !== user.username) data.username = username;
    if (email !== user.email) data.email = email;
    if (avatarUrl !== (user.avatar_url || '')) data.avatar_url = avatarUrl;
    if (password) data.password = password;

    if (Object.keys(data).length === 0) {
      setLoading(false);
      return;
    }

    try {
      await updateProfile(data);
      setSuccess(true);
      setPassword('');
    } catch (err) {
      setError(err.response?.data?.detail || "Errore durante l'aggiornamento del profilo.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setRawImageSrc(reader.result);
      setShowCropper(true);
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  const handleCropComplete = async (croppedBlob) => {
    setShowCropper(false);
    setRawImageSrc(null);
    setUploadLoading(true);
    setError(null);
    try {
      const file = new File([croppedBlob], 'avatar.jpg', { type: 'image/jpeg' });
      const { url } = await uploadAvatar(file);
      setAvatarUrl(url);
    } catch (err) {
      setError('Errore durante il caricamento dell\'immagine. Riprova.');
    } finally {
      setUploadLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      {/* Cropper Modal */}
      {showCropper && rawImageSrc && (
        <ImageCropper
          imageSrc={rawImageSrc}
          onCropComplete={handleCropComplete}
          onCancel={() => { setShowCropper(false); setRawImageSrc(null); }}
        />
      )}

      <div className="flex items-center gap-4 mb-8">
        {/* Clickable avatar preview */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="Clicca per cambiare foto profilo"
          className="relative w-16 h-16 rounded-full bg-accent text-white flex items-center justify-center text-2xl font-bold shadow-lg shadow-accent/20 flex-shrink-0 overflow-hidden group cursor-pointer"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" className="w-full h-full rounded-full object-cover" />
          ) : (
            username.charAt(0).toUpperCase()
          )}
          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-full flex items-center justify-center">
            <FiUpload className="text-white text-lg" />
          </div>
        </button>
        <div>
          <h1 className="text-3xl font-display font-bold text-text tracking-wide">Il tuo Profilo</h1>
          <p className="text-text-dim text-sm mt-1">Gestisci le informazioni del tuo account</p>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="bg-surface/50 border border-border/50 rounded-2xl p-6 shadow-xl backdrop-blur-sm relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full blur-3xl pointer-events-none"></div>

        {error && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl mb-6 text-sm">
            <FiAlertCircle className="shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 p-3 rounded-xl mb-6 text-sm">
            <FiCheckCircle className="shrink-0" />
            <p>Profilo aggiornato con successo!</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
          <div>
            <label className="block text-sm font-medium text-text-dim mb-1 ml-1">Username</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-dim">
                <FiUser />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full bg-bg/80 border border-surface-light rounded-xl py-3 pl-10 pr-4 text-text placeholder-text-dim focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-dim mb-1 ml-1">Email</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-dim">
                <FiMail />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-bg/80 border border-surface-light rounded-xl py-3 pl-10 pr-4 text-text placeholder-text-dim focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-dim mb-1 ml-1">Immagine Profilo</label>
            <div className="flex gap-2">
              {/* URL text input */}
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-dim">
                  <FiImage />
                </div>
                <input
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://esempio.com/avatar.jpg"
                  className="w-full bg-bg/80 border border-surface-light rounded-xl py-3 pl-10 pr-4 text-text placeholder-text-dim focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                />
              </div>
              {/* Upload button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-border bg-surface hover:border-accent/40 hover:bg-accent/5 text-text-dim hover:text-text transition-all disabled:opacity-50 whitespace-nowrap"
                title="Carica dal dispositivo"
              >
                {uploadLoading ? (
                  <span className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin"></span>
                ) : (
                  <FiUpload />
                )}
                {uploadLoading ? 'Caricamento...' : 'Dal dispositivo'}
              </button>
            </div>
            {/* Preview thumbnail */}
            {avatarUrl && (
              <div className="mt-3 flex items-center gap-3">
                <img src={avatarUrl} alt="Preview avatar" className="w-10 h-10 rounded-full object-cover border border-border/50" onError={(e) => e.target.style.display = 'none'} />
                <span className="text-xs text-text-dim">Anteprima</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-text-dim mb-1 ml-1">Nuova Password (lascia vuoto per non cambiare)</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-dim">
                <FiLock />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-bg/80 border border-surface-light rounded-xl py-3 pl-10 pr-4 text-text placeholder-text-dim focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto mt-6 bg-accent hover:bg-accent-hover text-white font-medium py-3 px-8 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 shadow-lg shadow-accent/20 hover:scale-105"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
              <>
                <FiSave />
                Salva Modifiche
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
