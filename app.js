const { useState, useEffect, useRef } = React;

const App = () => {
    const [speed, setSpeed] = useState(0);
    const [breakInfo, setBreakInfo] = useState({ drop: 0, break: 0 });
    const [isAutoMode, setIsAutoMode] = useState(true);
    const [isTiming, setIsTiming] = useState(false);
    const [distance, setDistance] = useState(60.5);
    const [cameraOffset, setCameraOffset] = useState(15); 
    const [sensitivity, setSensitivity] = useState(70); 
    const [envPreset, setEnvPreset] = useState('Auto');
    const [unit, setUnit] = useState('MPH');
    const [history, setHistory] = useState([]);
    const [showSettings, setShowSettings] = useState(false);
    const [status, setStatus] = useState("Initializing Radar...");

    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const procCanvasRef = useRef(document.createElement('canvas'));
    const prevFrameRef = useRef(null);
    
    const startTimeRef = useRef(0);
    const motionBufferRef = useRef([]); 
    const flightPathRef = useRef([]);
    const lockCountRef = useRef(0);
    const coolDownRef = useRef(0);
    const requestRef = useRef();

    // RESTORED: Smart Environment Presets
    const applyPreset = (mode) => {
        setEnvPreset(mode);
        switch(mode) {
            case 'Day': setSensitivity(85); setStatus("Day Mode: High Precision"); break;
            case 'Night': setSensitivity(60); setStatus("Night Mode: Noise Filtering"); break;
            case 'Overcast': setSensitivity(75); setStatus("Cloudy: Balanced"); break;
            case 'Indoor': setSensitivity(40); setStatus("Indoor: Max Stability"); break;
        }
    };

    // RESTORED: Auto-Detect Logic
    useEffect(() => {
        if (envPreset === 'Auto') {
            const hour = new Date().getHours();
            const isNight = (hour >= 19 || hour <= 6);
            if (isNight) {
                setSensitivity(60);
                setStatus("Auto: Night Game Config");
            } else {
                setSensitivity(85);
                setStatus("Auto: Sunny Day Config");
            }
        }
    }, [envPreset]);

    useEffect(() => {
        const initCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment', frameRate: { ideal: 60 } },
                    audio: false
                });
                if (videoRef.current) videoRef.current.srcObject = stream;
            } catch (err) { setStatus("Camera Error."); }
        };
        initCamera();
        return () => {
            cancelAnimationFrame(requestRef.current);
            if (videoRef.current?.srcObject) videoRef.current.srcObject.getTracks().forEach(t => t.stop());
        };
    }, []);

    const processMotion = () => {
        if (!videoRef.current || videoRef.current.readyState !== 4) {
            requestRef.current = requestAnimationFrame(processMotion);
            return;
        }

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { alpha: false });
        const procCanvas = procCanvasRef.current;
        const pCtx = procCanvas.getContext('2d', { willReadFrequently: true });
        
        if (procCanvas.width !== 160) {
            procCanvas.width = 160;
            procCanvas.height = (video.videoHeight / video.videoWidth) * 160;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
        }

        pCtx.drawImage(video, 0, 0, procCanvas.width, procCanvas.height);
        const currentFrame = pCtx.getImageData(0, 0, procCanvas.width, procCanvas.height);
        
        if (prevFrameRef.current && isAutoMode) {
            if (performance.now() < coolDownRef.current) {
                requestRef.current = requestAnimationFrame(processMotion);
                return;
            }

            let motionX = 0; let motionY = 0; let motionCount = 0;
            const threshold = 130 - sensitivity; 

            for (let i = 0; i < currentFrame.data.length; i += 4) {
                const diff = Math.abs(currentFrame.data[i] - prevFrameRef.current.data[i]);
                if (diff > threshold) { 
                    const rightDiff = Math.abs(currentFrame.data[i+4] - prevFrameRef.current.data[i+4]);
                    if (rightDiff > threshold) {
                        const pixelIndex = i / 4;
                        motionX += pixelIndex % procCanvas.width;
                        motionY += Math.floor(pixelIndex / procCanvas.width);
                        motionCount++;
                    }
                }
            }

            const isCameraMoving = motionCount > (procCanvas.width * procCanvas.height * 0.08);

            if (motionCount > 8 && motionCount < 100 && !isCameraMoving) { 
                lockCountRef.current++;
                if (lockCountRef.current > 6) { 
                    const avgX = (motionX / motionCount) * (canvas.width / procCanvas.width);
                    const avgY = (motionY / motionCount) * (canvas.height / procCanvas.height);
                    drawTracker(ctx, avgX, avgY);
                    
                    if (isTiming) {
                        flightPathRef.current.push({ x: avgX, y: avgY, t: performance.now() });
                    }
                    
                    handleMotionTrigger(motionCount, performance.now(), avgX, avgY);
                }
            } else {
                lockCountRef.current = 0;
                if (isCameraMoving || motionCount === 0) {
                    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
                    if (isTiming) setIsTiming(false); 
                    motionBufferRef.current = [];
                }
            }
        }

        prevFrameRef.current = currentFrame;
        requestRef.current = requestAnimationFrame(processMotion);
    };

    const drawTracker = (ctx, x, y) => {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.strokeStyle = '#10b981'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(x, y, 30, 0, Math.PI * 2); ctx.stroke();
    };

    const handleMotionTrigger = (count, time, x, y) => {
        const currentMotion = { x, y, time, count };
        motionBufferRef.current.push(currentMotion);
        if (motionBufferRef.current.length > 8) motionBufferRef.current.shift();

        if (motionBufferRef.current.length >= 6 && !isTiming) {
            const first = motionBufferRef.current[0];
            const mid = motionBufferRef.current[3];
            const last = motionBufferRef.current[motionBufferRef.current.length - 1];
            const dx1 = mid.x - first.x; const dy1 = mid.y - first.y;
            const dx2 = last.x - mid.x; const dy2 = last.y - mid.y;
            const isLinear = (Math.sign(dx1) === Math.sign(dx2)) && (Math.sign(dy1) === Math.sign(dy2));
            const totalDx = last.x - first.x; const totalDy = last.y - first.y;
            const dt = last.time - first.time;
            const velocity = Math.sqrt(totalDx*totalDx + totalDy*totalDy) / dt;

            if (velocity > 0.8 && isLinear) {
                startTimeRef.current = first.time;
                setIsTiming(true);
                flightPathRef.current = [{ x, y, t: time }];
                setStatus("PITCH DETECTED!");
                motionBufferRef.current = [];
            }
        }
    };

    const analyzeBreak = (path) => {
        if (path.length < 10) return { drop: 0, break: 0 };
        const start = path[0];
        const mid = path[Math.floor(path.length * 0.2)];
        const dx = mid.x - start.x; const dy = mid.y - start.y; const dt = mid.t - start.t;
        const totalT = (path[path.length - 1].t - start.t);
        const projectedX = start.x + (dx / dt) * totalT;
        const projectedY = start.y + (dy / dt) * totalT;
        const actual = path[path.length - 1];
        const pxToInches = 1.5; 
        return {
            break: Math.round((actual.x - projectedX) * pxToInches * 10) / 10,
            drop: Math.round((actual.y - projectedY) * pxToInches * 10) / 10
        };
    };

    const calculateTrueVelocity = (durationSeconds) => {
        if (durationSeconds < 0.2) return;
        coolDownRef.current = performance.now() + 2000;
        
        const info = analyzeBreak(flightPathRef.current);
        setBreakInfo(info);
        flightPathRef.current = [];

        const effectiveDistance = Math.sqrt(Math.pow(distance, 2) + Math.pow(cameraOffset, 2));
        const vAvg = effectiveDistance / durationSeconds;
        const k = 0.0015; 
        const v0_fps = (effectiveDistance * k) / (1 - Math.exp(-k * durationSeconds));
        const releaseVelocityMPH = v0_fps * 0.681818;
        const avgVelocityMPH = vAvg * 0.681818;
        const roundedSpeed = Math.round(releaseVelocityMPH * 10) / 10;

        setSpeed(roundedSpeed);
        setHistory(prev => [{
            speed: roundedSpeed,
            avg: Math.round(avgVelocityMPH * 10) / 10,
            break: info.break,
            drop: info.drop,
            unit,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }, ...prev].slice(0, 5));
        setStatus("TRAJECTORY CAPTURED!");
    };

    const stopPitch = (manualTime = null) => {
        const endTime = manualTime || performance.now();
        const duration = (endTime - startTimeRef.current) / 1000;
        setIsTiming(false);
        calculateTrueVelocity(duration);
    };

    useEffect(() => {
        requestRef.current = requestAnimationFrame(processMotion);
        return () => cancelAnimationFrame(requestRef.current);
    }, [isAutoMode, distance, cameraOffset, sensitivity, unit]);

    return (
        <div className="app-container">
            <div className="camera-container"><video ref={videoRef} autoPlay playsInline muted /><canvas ref={canvasRef} className="tracking-canvas" /></div>
            <div className="overlay">
                <header className="header"><h1 className="title">RADAR PRO</h1><button className="settings-btn" onClick={() => setShowSettings(true)}><i data-lucide="settings"></i></button></header>
                <div className="status-tag">{status}</div>
                <div className="stats-display">
                    <div className={`speed-value ${isTiming ? 'pulse' : ''}`}>{isTiming ? '---' : speed}</div>
                    <div className="speed-unit">{unit} (REL)</div>
                    {!isTiming && speed > 0 && (
                        <div style={{display: 'flex', gap: '15px', marginTop: '10px', fontSize: '0.9rem', color: 'var(--safe)', fontWeight: 700}}>
                            <span>DROP: {breakInfo.drop}"</span><span>BREAK: {breakInfo.break}"</span>
                        </div>
                    )}
                </div>
            </div>
            <div className="interaction-area">
                <div style={{display: 'flex', gap: '20px', alignItems: 'center'}}>
                    <button className="mode-toggle" style={{borderColor: isAutoMode ? 'var(--safe)' : '#475569'}} onClick={() => setIsAutoMode(!isAutoMode)}>{isAutoMode ? "AUTO RADAR" : "MANUAL"}</button>
                    {!isAutoMode ? (
                        <div className={`trigger-btn ${isTiming ? 'active' : ''}`} onTouchStart={() => { startTimeRef.current = performance.now(); setIsTiming(true); setStatus("TIMING..."); }} onTouchEnd={() => stopPitch()}>
                            <div style={{fontWeight: 800}}>{isTiming ? 'STOP' : 'HOLD'}</div>
                        </div>
                    ) : (
                        <button className="trigger-btn" onClick={() => { setIsTiming(false); setStatus("RADAR RESET"); coolDownRef.current = 0; }} style={{width: '80px', height: '80px', fontSize: '0.8rem'}}>RESET</button>
                    )}
                </div>
            </div>
            {showSettings && (
                <div className="modal-overlay" onClick={() => setShowSettings(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header"><h2 className="modal-title">Radar Settings</h2><button className="close-btn" onClick={() => setShowSettings(false)} style={{fontSize: '1.5rem', fontWeight: 'bold'}}>&times;</button></div>
                        
                        <div className="form-group">
                            <label className="form-label">Environment Preset</label>
                            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px'}}>
                                {['Day', 'Night', 'Overcast', 'Indoor'].map(mode => (
                                    <button 
                                        key={mode}
                                        className="mode-toggle"
                                        style={{
                                            borderColor: envPreset === mode ? 'var(--safe)' : '#475569',
                                            fontSize: '0.65rem',
                                            padding: '8px',
                                            background: envPreset === mode ? 'rgba(16, 185, 129, 0.1)' : 'transparent'
                                        }}
                                        onClick={() => applyPreset(mode)}
                                    >
                                        {mode.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                            <button 
                                className="mode-toggle"
                                style={{width: '100%', fontSize: '0.7rem', borderColor: envPreset === 'Auto' ? 'var(--primary)' : '#475569'}}
                                onClick={() => setEnvPreset('Auto')}
                            >
                                AUTO-DETECT (TIME & LOCATION)
                            </button>
                        </div>

                        <div className="form-group"><label className="form-label">Manual Sensitivity: {sensitivity}</label><input type="range" min="20" max="95" step="5" value={sensitivity} onChange={e => { setSensitivity(parseInt(e.target.value)); setEnvPreset('Manual'); }} style={{width: '100%', height: '40px'}}/></div>
                        <div className="form-group"><label className="form-label">Pitch Distance: {distance}ft</label><input type="range" min="40" max="70" step="0.5" value={distance} onChange={e => setDistance(parseFloat(e.target.value))} style={{width: '100%', height: '40px'}}/></div>
                        <div className="form-group"><label className="form-label">Camera Offset: {cameraOffset}ft</label><input type="range" min="0" max="30" step="1" value={cameraOffset} onChange={e => setCameraOffset(parseFloat(e.target.value))} style={{width: '100%', height: '40px'}}/></div>
                        
                        <div style={{fontWeight: 700, marginBottom: '10px', fontSize: '0.9rem'}}>Recent (Rel / Drop / Break)</div>
                        <div className="history-list">
                            {history.length === 0 ? <p style={{color: '#94a3b8', fontSize: '0.8rem'}}>No history yet</p> : 
                             history.map((h, i) => (<div key={i} className="history-item"><span style={{fontWeight: 700}}>{h.speed} / {h.drop}" / {h.break}"</span><span style={{color: '#94a3b8'}}>{h.time}</span></div>))}
                        </div>
                        <button className="mode-toggle" style={{width: '100%', marginTop: '20px', background: 'var(--primary)', border: 'none'}} onClick={() => setShowSettings(false)}>DONE & SAVE</button>
                    </div>
                </div>
            )}
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
setTimeout(() => window.lucide?.createIcons(), 500);
