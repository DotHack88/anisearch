import { Component } from 'react'

/**
 * React Error Boundary — catches JS errors in child components
 * and renders a fallback UI instead of crashing the entire app.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 page-enter">
          <div className="bg-surface/60 border border-border rounded-2xl p-10 max-w-md backdrop-blur-sm">
            <p className="text-5xl mb-4">💥</p>
            <h2 className="font-display text-2xl tracking-wide text-text mb-3">
              QUALCOSA È <span className="text-accent">ANDATO STORTO</span>
            </h2>
            <p className="text-sm text-text-dim font-body mb-6">
              Si è verificato un errore imprevisto. Prova a ricaricare la pagina o torna alla home.
            </p>

            <div className="flex flex-wrap gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="px-5 py-2.5 bg-accent hover:bg-accent-h text-white rounded-xl text-xs font-semibold font-body transition-all shadow-lg shadow-accent/20"
              >
                Riprova
              </button>
              <a
                href="/"
                className="px-5 py-2.5 bg-surface border border-border hover:border-accent/40 text-text-dim hover:text-text rounded-xl text-xs font-semibold font-body transition-all"
              >
                Torna alla Home
              </a>
            </div>

            {this.state.error && (
              <details className="mt-6 text-left">
                <summary className="text-[10px] text-muted cursor-pointer font-body">
                  Dettagli tecnici
                </summary>
                <pre className="mt-2 text-[10px] text-red-400/80 bg-black/30 rounded-lg p-3 overflow-x-auto font-mono whitespace-pre-wrap">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
