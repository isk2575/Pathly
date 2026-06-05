const alerts = [
  {
    id: 1,
    type: "Suspicious Activity",
    location: "Near Parking Lot B",
    time: "Today, 8:32 PM",
    distance: "0.3 mi",
    color: "yellow",
  },
  {
    id: 2,
    type: "Theft Report",
    location: "Near Student Center",
    time: "Today, 6:15 PM",
    distance: "0.2 mi",
    color: "yellow",
  },
  {
    id: 3,
    type: "Road Closed",
    location: "Near Engineering Building",
    time: "Today, 5:40 PM",
    distance: "0.4 mi",
    color: "red",
  },
  {
    id: 4,
    type: "Maintenance",
    location: "Pathway near Cougar Woods",
    time: "Today, 4:20 PM",
    distance: "0.6 mi",
    color: "blue",
  },
];

const colorMap = {
  yellow: {
    bg: "bg-yellow-900/30",
    border: "border-yellow-800",
    icon: "bg-yellow-500",
    text: "text-yellow-400",
  },
  red: {
    bg: "bg-red-900/30",
    border: "border-red-800",
    icon: "bg-red-500",
    text: "text-red-400",
  },
  blue: {
    bg: "bg-blue-900/30",
    border: "border-blue-800",
    icon: "bg-blue-500",
    text: "text-blue-400",
  },
};

export default function AlertsFeed({ darkMode }) {
  return (
    <div className={`absolute z-10 rounded-2xl shadow-2xl ${
      darkMode ? 'bg-gray-900/95 border border-gray-800' : 'bg-white/95 border border-gray-200'
    } backdrop-blur-md p-5 flex flex-col gap-3`}
    style={{ top: '420px', right: '16px', width: '288px',maxHeight: 'calc(100vh - 450px)', overflowY: 'auto' }}>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className={`font-semibold text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          Campus Alerts
        </h2>
        <button className="text-blue-400 text-xs font-medium hover:text-blue-300 transition-all">
          View All
        </button>
      </div>

      {/* Alerts List */}
      <div className="flex flex-col gap-2">
        {alerts.map((alert) => {
          const c = colorMap[alert.color];
          return (
            <div key={alert.id} className={`rounded-xl p-3 border ${c.bg} ${c.border} flex items-start gap-3`}>
              
              {/* Icon */}
              <div className={`w-7 h-7 rounded-full ${c.icon} flex items-center justify-center shrink-0 mt-0.5`}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                </svg>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${c.text}`}>{alert.type}</p>
                <p className={`text-xs mt-0.5 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  {alert.location}
                </p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-gray-500">{alert.time}</p>
                  <p className="text-xs text-gray-500">{alert.distance}</p>
                </div>
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
}