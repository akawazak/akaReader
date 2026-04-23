import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  componentDidCatch(e, info) { console.error('[ErrorBoundary]', e, info); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0a0f', color: '#f87171', gap: 16, padding: 32 }}>
        <span style={{ fontSize: 32 }}>💥</span>
        <h2 style={{ color: '#f1f5f9', margin: 0 }}>Something crashed</h2>
        <p style={{ color: '#64748b', textAlign: 'center', maxWidth: 400 }}>{this.state.error.message}</p>
        <button
          onClick={() => this.setState({ error: null })}
          style={{ padding: '10px 24px', background: 'var(--accent)', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}
        >Try again</button>
      </div>
    );
  }
}
