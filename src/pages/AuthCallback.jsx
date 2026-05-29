import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { exchangeCodeForToken } from '../services/googleCalendar';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('connecting');
  const [msg,    setMsg]    = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code  = params.get('code');
    const error = params.get('error');

    if (error) {
      setStatus('error');
      setMsg(error === 'access_denied' ? 'Access denied. You can reconnect from Settings.' : error);
      setTimeout(() => navigate('/settings'), 3000);
      return;
    }

    if (!code) {
      navigate('/');
      return;
    }

    exchangeCodeForToken(code)
      .then(() => {
        setStatus('success');
        setTimeout(() => navigate('/'), 2000);
      })
      .catch(e => {
        setStatus('error');
        setMsg(e.message || 'Authentication failed. Please try again.');
        setTimeout(() => navigate('/settings'), 3000);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="text-center max-w-sm w-full">
        {status === 'connecting' && (
          <>
            <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white font-semibold text-lg">Connecting Google Calendar…</p>
            <p className="text-sm text-slate-400 mt-2">Exchanging authorization code</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">✓</span>
            </div>
            <p className="text-white font-semibold text-lg text-green-400">Google Calendar connected!</p>
            <p className="text-sm text-slate-400 mt-2">Redirecting to dashboard…</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">✗</span>
            </div>
            <p className="text-white font-semibold text-lg text-red-400">Connection failed</p>
            {msg && <p className="text-sm text-slate-400 mt-2">{msg}</p>}
            <p className="text-sm text-slate-500 mt-1">Redirecting to Settings…</p>
          </>
        )}
      </div>
    </div>
  );
}
