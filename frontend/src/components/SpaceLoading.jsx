const LOADING_TIPS = [
  "Orbital mechanics at work... 🌍",
  "SGP4 propagation running... 🛰️",
  "Screening 2000+ objects... 📡",
  "Checking for close approaches... 👀",
  "Space is really, really big... 🚀",
  "Debris moves at 28,000 km/h... ⚡",
  "Every second counts up there... ⏱️",
  "Collision avoidance is serious business... 🎯",
];

function getRandomTip() {
  return LOADING_TIPS[Math.floor(Math.random() * LOADING_TIPS.length)];
}

export default function SpaceLoading() {
  return (
    <div className="space-loading">
      <div className="space-loading-orbit">
        <div className="space-loading-ring" />
        <div className="space-loading-ring" />
        <div className="space-loading-ring" />
        <div className="space-loading-center" />
        <div className="space-loading-satellite" />
        <div className="space-loading-satellite" />
        <div className="space-loading-satellite" />
      </div>
      <h2 className="space-loading-title">Calculating Orbits</h2>
      <p className="space-loading-subtitle">
        Running SGP4 propagation and screening for conjunction risks...
      </p>
      <div className="space-loading-tips">
        <span className="space-loading-tip">{getRandomTip()}</span>
        <span className="space-loading-tip">Initializing TLE catalog...</span>
        <span className="space-loading-tip">This takes ~10 seconds</span>
      </div>
      <div className="space-loading-progress">
        <div className="space-loading-bar" />
      </div>
    </div>
  );
}
