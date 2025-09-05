export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 via-blue-50 to-indigo-200">
      <div className="bg-white/90 backdrop-blur-md rounded-3xl shadow-2xl p-12 max-w-2xl w-full border border-indigo-100">
        <h1 className="text-4xl font-extrabold text-center mb-12 text-transparent bg-clip-text bg-gradient-to-r from-indigo-700 via-blue-600 to-indigo-400 drop-shadow-lg">
          Payment Test Dashboard
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Blockchain Payment */}
          <a
            href="/blockchain"
            className="group flex flex-col items-center justify-center bg-gradient-to-tr from-blue-200 via-blue-100 to-blue-300 rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-all duration-200 hover:scale-105 border-2 border-blue-200 hover:border-blue-400 relative overflow-hidden"
          >
            <span className="absolute -top-8 -right-8 opacity-20 group-hover:opacity-30 transition">
              <svg width="100" height="100" viewBox="0 0 64 64" fill="none">
                <rect x="8" y="8" width="48" height="48" rx="12" fill="#6366F1" />
                <circle cx="32" cy="32" r="10" fill="#fff" />
                <rect x="28" y="18" width="8" height="8" rx="2" fill="#A5B4FC" />
                <rect x="18" y="38" width="8" height="8" rx="2" fill="#A5B4FC" />
                <rect x="38" y="38" width="8" height="8" rx="2" fill="#A5B4FC" />
                <line x1="32" y1="26" x2="22" y2="42" stroke="#6366F1" strokeWidth="2" />
                <line x1="32" y1="26" x2="42" y2="42" stroke="#6366F1" strokeWidth="2" />
              </svg>
            </span>
           
            <span className="text-lg font-bold text-blue-900 group-hover:text-blue-800 mb-1 z-10 drop-shadow">
              Blockchain Payment Test
            </span>
            <span className="text-sm text-blue-700 opacity-90 text-center z-10">
              Test payments using blockchain networks.
            </span>
            <span className="absolute bottom-0 left-0 w-full h-2 bg-gradient-to-r from-blue-400/30 via-blue-200/0 to-blue-400/30 rounded-b-2xl" />
          </a>
          {/* PayPal Payment */}
          <a
            href="/paypal"
            className="group flex flex-col items-center justify-center bg-gradient-to-tr from-yellow-200 via-yellow-100 to-yellow-300 rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-all duration-200 hover:scale-105 border-2 border-yellow-200 hover:border-yellow-400 relative overflow-hidden"
          >
            <span className="absolute -top-8 -right-8 opacity-20 group-hover:opacity-30 transition">
              <svg width="100" height="100" viewBox="0 0 64 64" fill="none">
                <rect x="8" y="8" width="48" height="48" rx="12" fill="#FBBF24" />
                <path
                  d="M24 40l2.5-16h10.5a6 6 0 110 12h-7l-.5 4h6.5a4 4 0 100-8h-7"
                  stroke="#fff"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
                <circle cx="32" cy="32" r="22" stroke="#F59E42" strokeWidth="2" fill="none" />
              </svg>
            </span>
            <span className="text-lg font-bold text-yellow-900 group-hover:text-yellow-800 mb-1 z-10 drop-shadow">
              PayPal Payment Test
            </span>
            <span className="text-sm text-yellow-700 opacity-90 text-center z-10">
              Test payments using PayPal integration.
            </span>
            <span className="absolute bottom-0 left-0 w-full h-2 bg-gradient-to-r from-yellow-400/30 via-yellow-200/0 to-yellow-400/30 rounded-b-2xl" />
          </a>
        </div>
      </div>
    </div>
  );
}