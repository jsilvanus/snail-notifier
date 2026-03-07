import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';

const COLORS = ['#dbeafe', '#dcfce7', '#fef9c3', '#fce7f3', '#f3e8ff', '#ffedd5', '#e0f2fe', '#d1fae5'];

function randomColor() { return COLORS[Math.floor(Math.random() * COLORS.length)]; }

function extractScanToken(raw) {
  const m = raw.match(/\/api\/scan\/([^/?#]+)/);
  return m ? m[1] : raw.trim();
}

// ── QR Scanner ──────────────────────────────────────────────────────────────

function QRScanner({ onScanned, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    let active = true;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        streamRef.current = stream;
        if (videoRef.current && active) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          tick();
        }
      } catch (err) {
        alert(`Camera error: ${err.message}`);
        onClose();
      }
    }

    function tick() {
      if (!active || !videoRef.current || videoRef.current.readyState < 2) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      import('jsqr').then(({ default: jsQR }) => {
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code) { onScanned(code.data); return; }
        if (active) rafRef.current = requestAnimationFrame(tick);
      });
    }

    start();

    return () => {
      active = false;
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [onScanned, onClose]);

  return (
    <div className="scanner-wrap">
      <video ref={videoRef} playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <div className="scanner-bar" />
      <button className="scanner-close btn" onClick={onClose}>✕ Close</button>
      <div style={{ position: 'absolute', bottom: '2rem', left: 0, right: 0, textAlign: 'center', color: 'white', fontSize: '.9rem', background: 'rgba(0,0,0,.4)', padding: '.5rem' }}>
        Point camera at a Snail Notifier QR code
      </div>
    </div>
  );
}

// ── NFC Scanner ─────────────────────────────────────────────────────────────

async function startNFCScan(onScanned, onError) {
  if (!('NDEFReader' in window)) { onError('NFC not supported in this browser (requires Chrome on Android)'); return null; }
  try {
    const reader = new window.NDEFReader();
    await reader.scan();
    reader.onreading = ({ message }) => {
      for (const record of message.records) {
        if (record.recordType === 'url') {
          const text = new TextDecoder().decode(record.data);
          onScanned(text);
          break;
        }
      }
    };
    return reader;
  } catch (err) {
    onError(`NFC error: ${err.message}`);
    return null;
  }
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function AddToken() {
  const { shareCode } = useParams();
  const navigate = useNavigate();

  const [mode, setMode] = useState('menu'); // menu | qr | nfc | manual | preview
  const [manualInput, setManualInput] = useState('');
  const [preview, setPreview] = useState(null);
  const [customLabel, setCustomLabel] = useState('');
  const [color, setColor] = useState(randomColor);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const nfcReaderRef = useRef(null);

  const handleScanned = useCallback(async (raw) => {
    setMode('menu');
    const scanToken = extractScanToken(raw);
    setLoading(true);
    setError('');
    try {
      const info = await api.getTokenInfo(scanToken);
      setPreview({ ...info, scanToken });
      setCustomLabel(info.title || info.name || '');
      setMode('preview');
    } catch (err) {
      setError(`Could not load token: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  async function handleNFC() {
    setMode('nfc');
    setError('');
    nfcReaderRef.current = await startNFCScan(handleScanned, msg => { setError(msg); setMode('menu'); });
  }

  function stopNFC() {
    setMode('menu');
  }

  async function handleManualSubmit(e) {
    e.preventDefault();
    await handleScanned(manualInput);
  }

  async function handleAdd() {
    setSaving(true);
    try {
      await api.addTokenButton(shareCode, {
        scan_token: preview.scanToken,
        label: customLabel || preview.title || preview.name || undefined,
        color,
      });
      navigate(`/board/${shareCode}`);
    } catch (err) {
      setError(`Failed to add button: ${err.message}`);
      setSaving(false);
    }
  }

  if (mode === 'qr') {
    return <QRScanner onScanned={handleScanned} onClose={() => setMode('menu')} />;
  }

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <header>
        <button className="btn btn-ghost" style={{ fontSize: '.85rem', padding: '.35rem .75rem' }} onClick={() => navigate(`/board/${shareCode}`)}>← Back</button>
        <span className="brand" style={{ flex: 1, textAlign: 'center' }}>Add Token Button</span>
        <span style={{ width: 80 }} />
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 480, margin: '0 auto', width: '100%' }}>
        {mode === 'preview' && preview ? (
          <div className="card">
            <h3 style={{ marginBottom: '.5rem' }}>{preview.title || preview.name}</h3>
            {preview.description && <p style={{ color: 'var(--muted)', fontSize: '.875rem', marginBottom: '1rem' }}>{preview.description}</p>}
            <div style={{ fontSize: '.8rem', color: 'var(--muted)', marginBottom: '1rem' }}>
              {preview.type} &middot; {preview.behavior === 'data_input' ? 'Asks for input' : 'Simple trigger'} &middot; {preview.mailbox_label || 'No label'}
            </div>
            <div className="form-group">
              <label>Button label</label>
              <input value={customLabel} onChange={e => setCustomLabel(e.target.value)} placeholder={preview.title || preview.name} />
            </div>
            <div className="form-group">
              <label>Button color</label>
              <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginTop: '.25rem' }}>
                {COLORS.map(c => (
                  <button key={c} onClick={() => setColor(c)} style={{ width: '2rem', height: '2rem', background: c, border: color === c ? '2.5px solid #0ea5e9' : '1.5px solid #e2e8f0', borderRadius: 8, cursor: 'pointer' }} />
                ))}
              </div>
            </div>
            {error && <p style={{ color: '#dc2626', fontSize: '.875rem', marginBottom: '.5rem' }}>{error}</p>}
            <div style={{ display: 'flex', gap: '.5rem', marginTop: '.5rem' }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleAdd} disabled={saving}>
                {saving ? 'Adding…' : 'Add to Layout'}
              </button>
              <button className="btn btn-ghost" onClick={() => setMode('menu')}>Cancel</button>
            </div>
          </div>
        ) : mode === 'nfc' ? (
          <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📡</div>
            <h3>Waiting for NFC…</h3>
            <p style={{ color: 'var(--muted)', fontSize: '.9rem', marginTop: '.5rem', marginBottom: '1.5rem' }}>Hold an NFC tag near your device.</p>
            <button className="btn btn-ghost" onClick={stopNFC}>Cancel</button>
            {error && <p style={{ color: '#dc2626', marginTop: '1rem', fontSize: '.875rem' }}>{error}</p>}
          </div>
        ) : (
          <>
            {error && <div className="card" style={{ background: '#fef2f2', color: '#dc2626', fontSize: '.875rem' }}>{error}</div>}
            {loading && <div className="card" style={{ textAlign: 'center', color: 'var(--muted)' }}>Loading token info…</div>}

            <button className="btn btn-primary" style={{ padding: '1rem', fontSize: '1.05rem', borderRadius: 12 }} onClick={() => setMode('qr')}>
              📷 Scan QR Code
            </button>
            <button className="btn btn-ghost" style={{ padding: '1rem', fontSize: '1.05rem' }} onClick={handleNFC}>
              📡 Scan NFC Tag
            </button>

            <div className="card">
              <h4 style={{ marginBottom: '.75rem', color: 'var(--muted)', fontSize: '.875rem' }}>Or enter scan URL / token manually</h4>
              <form onSubmit={handleManualSubmit} style={{ display: 'flex', gap: '.5rem' }}>
                <input value={manualInput} onChange={e => setManualInput(e.target.value)} placeholder="Paste scan URL or token…" required />
                <button className="btn btn-primary" type="submit" style={{ whiteSpace: 'nowrap' }}>Add</button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
