import { signOut } from 'firebase/auth';
import { auth } from '../Firebase';
import { useNavigate } from 'react-router-dom';

export default function Navbar({ darkMode, setDarkMode }) {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut(auth);
    navigate('/');
  };

 return (
    <div className={`absolute top-0 left-0 right-0 z-10 flex items-center px-6 py-4 ${
      darkMode ? 'bg-gray-950/90' : 'bg-white/90'
    } backdrop-blur-md shadow-md`}>

      {/* Left spacer */}
      <div className="flex-1" />

      {/* Logo - centered */}
      <h1 className={`text-5xl font-bold tracking-tight relative ${
        darkMode ? 'text-white' : 'text-gray-900'
      }`}>
        <span className="absolute -inset-2 rounded-lg animate-pulse bg-red-600/30 blur-md" />
        <span className="relative">Pathly</span>
      </h1>

      {/* Right side buttons */}
      <div className="flex-1 flex justify-end items-center gap-4">
        <button
          onClick={() => setDarkMode(!darkMode)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            darkMode
              ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {darkMode ? '☀️ Light' : '🌙 Dark'}
        </button>

        <button
          onClick={handleSignOut}
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-700 text-white transition-all"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}