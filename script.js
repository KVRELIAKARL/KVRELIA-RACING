document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const startScreen = document.getElementById('startScreen');
    const startButton = document.getElementById('startButton');
    const lapCounter = document.getElementById('lapCounter');
    const positionDisplay = document.getElementById('position');
    const speedDisplay = document.getElementById('speed');
    
    // Game state
    let gameRunning = false;
    let raceStarted = false;
    let player = {};
    let aiCars = [];
    let track = {};
    let lapCount = 1;
    const totalLaps = 3;
    let checkpoints = [];
    let lastCheckpoint = 0;
    let positions = [];
    
    // Track definition (a large oval track with some curves)
    const trackSegments = [
        { curve: 0, distance: 1000 },   // Long straight
        { curve: 2, distance: 500 },    // Gentle right curve
        { curve: 0, distance: 500 },    // Short straight
        { curve: -3, distance: 600 },   // Sharp left curve
        { curve: 0, distance: 800 },    // Medium straight
        { curve: 4, distance: 400 },    // Right curve
        { curve: -2, distance: 600 },   // Left curve
        { curve: 0, distance: 1200 },   // Long straight back to start
    ];
    
    // Initialize game
    function initGame() {
        // Track properties
        track = {
            segments: trackSegments,
            totalDistance: trackSegments.reduce((sum, seg) => sum + seg.distance, 0),
            width: 2000,
            rumbleWidth: 300,
            segmentLength: 200,
            colors: {
                road: '#6B6B6B',
                grass: '#4A7023',
                rumble: '#FFFFFF',
                lane: '#CCCCCC'
            }
        };
        
        // Player car
        player = {
            x: canvas.width / 2,
            y: canvas.height / 2,
            width: 30,
            height: 50,
            speed: 0,
            maxSpeed: 300,
            acceleration: 1.5,
            deceleration: 2,
            brakingPower: 4,
            reverseSpeed: 100,
            steering: 0,
            maxSteering: 0.1,
            steeringSpeed: 0.03,
            driftFactor: 0.95,
            color: '#FF0000',
            segment: 0,
            offset: 0,
            z: 0,
            lap: 1,
            nextCheckpoint: 0,
            position: 1
        };
        
        // AI cars
        aiCars = [];
        const aiColors = ['#0000FF', '#00FF00', '#FFFF00', '#FF00FF'];
        for (let i = 0; i < 4; i++) {
            aiCars.push({
                width: 30,
                height: 50,
                speed: 150 + Math.random() * 50,
                maxSpeed: 250 + Math.random() * 50,
                acceleration: 1 + Math.random(),
                steering: 0,
                maxSteering: 0.08,
                steeringSpeed: 0.02 + Math.random() * 0.01,
                color: aiColors[i],
                segment: Math.floor(Math.random() * track.segments.length),
                offset: (Math.random() - 0.5) * (track.width / 3),
                z: 0,
                lap: 1,
                nextCheckpoint: 0,
                position: i + 2,
                aiBehavior: {
                    aggression: 0.5 + Math.random() * 0.5,
                    skill: 0.5 + Math.random() * 0.5
                }
            });
        }
        
        // Create checkpoints (one per segment)
        checkpoints = [];
        let distance = 0;
        for (let i = 0; i < track.segments.length; i++) {
            checkpoints.push(distance);
            distance += track.segments[i].distance;
        }
        
        // Initialize positions
        updatePositions();
        
        gameRunning = true;
        raceStarted = false;
        lapCount = 1;
        lastCheckpoint = 0;
        
        // Start game loop
        requestAnimationFrame(gameLoop);
    }
    
    // Game loop
    function gameLoop(timestamp) {
        if (!gameRunning) return;
        
        update();
        render();
        
        requestAnimationFrame(gameLoop);
    }
    
    // Update game state
    function update() {
        if (!raceStarted) return;
        
        // Update player car
        updateCar(player, true);
        
        // Update AI cars
        aiCars.forEach(car => {
            updateAI(car);
            updateCar(car, false);
        });
        
        // Update positions
        updatePositions();
        
        // Update UI
        updateUI();
        
        // Check for lap completion
        checkLapCompletion();
    }
    
    // Update car physics
    function updateCar(car, isPlayer) {
        // Apply friction
        car.speed *= 0.98;
        
        // Limit speed
        if (car.speed > car.maxSpeed) car.speed = car.maxSpeed;
        if (car.speed < -car.reverseSpeed) car.speed = -car.reverseSpeed;
        
        // Move car along track
        car.z += car.speed;
        
        // Wrap around track
        if (car.z >= track.totalDistance) car.z -= track.totalDistance;
        if (car.z < 0) car.z += track.totalDistance;
        
        // Find current segment
        let seg = findSegment(car.z);
        car.segment = seg.index;
        
        // Curve effect
        car.offset += car.steering * car.speed * 0.01;
        
        // Keep car on track
        const maxOffset = track.width / 2 - car.width / 2;
        if (car.offset < -maxOffset) car.offset = -maxOffset;
        if (car.offset > maxOffset) car.offset = maxOffset;
        
        // Check for checkpoints
        if (isPlayer) {
            const currentCheckpoint = findCurrentCheckpoint(car.z);
            if (currentCheckpoint !== -1 && currentCheckpoint !== car.nextCheckpoint) {
                if ((currentCheckpoint > car.nextCheckpoint) || 
                    (currentCheckpoint === 0 && car.nextCheckpoint === checkpoints.length - 1)) {
                    car.nextCheckpoint = currentCheckpoint;
                }
            }
        }
    }
    
    // Update AI behavior
    function updateAI(car) {
        const seg = track.segments[car.segment];
        const nextSeg = track.segments[(car.segment + 1) % track.segments.length];
        
        // Basic AI logic
        const targetOffset = (seg.curve * 50) * (1 - car.aiBehavior.skill);
        
        // Adjust speed based on curve
        const curveFactor = Math.abs(seg.curve) / 5;
        const targetSpeed = car.maxSpeed * (1 - curveFactor * 0.5);
        
        // Adjust speed to reach target
        if (car.speed < targetSpeed) {
            car.speed += car.acceleration * 0.5;
        } else {
            car.speed *= 0.99;
        }
        
        // Adjust steering to reach target offset
        if (car.offset < targetOffset) {
            car.steering += car.steeringSpeed * car.aiBehavior.aggression;
        } else if (car.offset > targetOffset) {
            car.steering -= car.steeringSpeed * car.aiBehavior.aggression;
        } else {
            car.steering *= 0.9;
        }
        
        // Limit steering
        if (car.steering > car.maxSteering) car.steering = car.maxSteering;
        if (car.steering < -car.maxSteering) car.steering = -car.maxSteering;
        
        // Random variations for more natural behavior
        if (Math.random() < 0.05) {
            car.steering += (Math.random() - 0.5) * car.steeringSpeed * 2;
        }
        
        // Check for checkpoints (simplified for AI)
        const currentCheckpoint = findCurrentCheckpoint(car.z);
        if (currentCheckpoint !== -1 && currentCheckpoint !== car.nextCheckpoint) {
            if ((currentCheckpoint > car.nextCheckpoint) || 
                (currentCheckpoint === 0 && car.nextCheckpoint === checkpoints.length - 1)) {
                car.nextCheckpoint = currentCheckpoint;
            }
        }
    }
    
    // Find current segment
    function findSegment(z) {
        let distance = 0;
        for (let i = 0; i < track.segments.length; i++) {
            distance += track.segments[i].distance;
            if (z < distance) {
                return {
                    index: i,
                    segment: track.segments[i],
                    percent: (z - (distance - track.segments[i].distance)) / track.segments[i].distance
                };
            }
        }
        return { index: 0, segment: track.segments[0], percent: 0 };
    }
    
    // Find current checkpoint
    function findCurrentCheckpoint(z) {
        for (let i = 0; i < checkpoints.length; i++) {
            const next = (i + 1) % checkpoints.length;
            const wrap = next === 0;
            
            if (wrap) {
                if (z >= checkpoints[i] || z < checkpoints[next]) {
                    return i;
                }
            } else {
                if (z >= checkpoints[i] && z < checkpoints[next]) {
                    return i;
                }
            }
        }
        return -1;
    }
    
    // Update race positions
    function updatePositions() {
        // Create array with all cars
        const allCars = [player, ...aiCars];
        
        // Sort by lap (descending), then by checkpoint (descending), then by z (descending)
        allCars.sort((a, b) => {
            if (a.lap !== b.lap) return b.lap - a.lap;
            if (a.nextCheckpoint !== b.nextCheckpoint) return b.nextCheckpoint - a.nextCheckpoint;
            return b.z - a.z;
        });
        
        // Update positions
        allCars.forEach((car, index) => {
            car.position = index + 1;
        });
        
        positions = allCars;
    }
    
    // Check for lap completion
    function checkLapCompletion() {
        if (player.nextCheckpoint === 0 && lastCheckpoint === checkpoints.length - 1) {
            player.lap++;
            lapCount = player.lap;
            
            if (player.lap > totalLaps) {
                gameRunning = false;
                showRaceEnd();
            }
        }
        lastCheckpoint = player.nextCheckpoint;
    }
    
    // Show race end screen
    function showRaceEnd() {
        const endScreen = document.createElement('div');
        endScreen.id = 'endScreen';
        endScreen.style.position = 'absolute';
        endScreen.style.top = '0';
        endScreen.style.left = '0';
        endScreen.style.width = '100%';
        endScreen.style.height = '100%';
        endScreen.style.background = 'rgba(0, 0, 0, 0.7)';
        endScreen.style.display = 'flex';
        endScreen.style.flexDirection = 'column';
        endScreen.style.justifyContent = 'center';
        endScreen.style.alignItems = 'center';
        endScreen.style.color = 'white';
        
        const positionText = player.position === 1 ? '1st - You Win!' : 
                            player.position === 2 ? '2nd - Not bad!' : 
                            player.position === 3 ? '3rd - Try harder!' : 
                            `${player.position}th - Better luck next time!`;
        
        endScreen.innerHTML = `
            <h1>Race Finished!</h1>
            <h2>${positionText}</h2>
            <button id="restartButton">Race Again</button>
        `;
        
        document.getElementById('gameContainer').appendChild(endScreen);
        
        document.getElementById('restartButton').addEventListener('click', () => {
            document.getElementById('gameContainer').removeChild(endScreen);
            initGame();
            startRace();
        });
    }
    
    // Update UI
    function updateUI() {
        lapCounter.textContent = `${lapCount}/${totalLaps}`;
        positionDisplay.textContent = player.position;
        speedDisplay.textContent = Math.abs(Math.floor(player.speed));
    }
    
    // Render game
    function render() {
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw sky
        ctx.fillStyle = '#87CEEB';
        ctx.fillRect(0, 0, canvas.width, canvas.height / 2);
        
        // Draw road
        drawRoad();
        
        // Draw cars
        drawCar(player);
        aiCars.forEach(car => drawCar(car));
    }
    
    // Draw road
    function drawRoad() {
        const baseSegment = findSegment(player.z);
        const basePercent = baseSegment.percent;
        const playerSegment = baseSegment.index;
        
        // Draw from back to front (for perspective)
        for (let n = 0; n < 100; n++) {
            const segmentIndex = (playerSegment - n + track.segments.length) % track.segments.length;
            const segment = track.segments[segmentIndex];
            const segmentPercent = (n === 0) ? basePercent : 1;
            
            drawSegment(
                segmentIndex,
                segment,
                segmentPercent,
                n
            );
        }
    }
    
    // Draw a road segment
    function drawSegment(segmentIndex, segment, percent, n) {
        const scale = 1 - (n / 100);
        const y = canvas.height / 2 + (n * 10);
        const width = track.width * scale;
        const rumbleWidth = track.rumbleWidth * scale;
        const height = 100 * scale;
        
        // Grass
        ctx.fillStyle = track.colors.grass;
        ctx.fillRect(0, y - height, canvas.width, height);
        
        // Rumble strips
        ctx.fillStyle = track.colors.rumble;
        ctx.fillRect(0, y - height, canvas.width, 10 * scale);
        ctx.fillRect(0, y - 10 * scale, canvas.width, 10 * scale);
        
        // Road
        ctx.fillStyle = track.colors.road;
        ctx.fillRect(canvas.width / 2 - width / 2, y - height, width, height);
        
        // Lane markers
        if (segment.curve === 0) {
            ctx.fillStyle = track.colors.lane;
            const laneWidth = 10 * scale;
            const laneCount = Math.floor(width / 100);
            
            for (let i = 1; i < laneCount; i++) {
                const laneX = canvas.width / 2 - width / 2 + (width / laneCount) * i;
                ctx.fillRect(laneX - laneWidth / 2, y - height, laneWidth, height);
            }
        }
        
        // Draw cars on this segment
        drawCarsOnSegment(segmentIndex, scale, y);
    }
    
    // Draw cars on a segment
    function drawCarsOnSegment(segmentIndex, scale, y) {
        // Check player car
        if (player.segment === segmentIndex) {
            drawCarSprite(player, scale, y);
        }
        
        // Check AI cars
        aiCars.forEach(car => {
            if (car.segment === segmentIndex) {
                drawCarSprite(car, scale, y);
            }
        });
    }
    
    // Draw car sprite
    function drawCarSprite(car, scale, segmentY) {
        const carWidth = car.width * scale;
        const carHeight = car.height * scale;
        const carX = canvas.width / 2 + car.offset * scale - carWidth / 2;
        const carY = segmentY - carHeight;
        
        ctx.fillStyle = car.color;
        ctx.fillRect(carX, carY, carWidth, carHeight);
        
        // Add some details
        ctx.fillStyle = '#000000';
        ctx.fillRect(carX + 5 * scale, carY + 5 * scale, carWidth - 10 * scale, 10 * scale); // windshield
        ctx.fillRect(carX + 5 * scale, carY + carHeight - 15 * scale, carWidth - 10 * scale, 10 * scale); // rear
        
        // If drifting, add smoke
        if (car === player && Math.abs(player.steering) > player.maxSteering * 0.8 && player.speed > 50) {
            ctx.fillStyle = `rgba(200, 200, 200, ${Math.random() * 0.5})`;
            const smokeX = carX + (player.steering > 0 ? 0 : carWidth);
            const smokeY = carY + carHeight / 2;
            const smokeSize = 20 * scale * Math.random();
            ctx.beginPath();
            ctx.arc(smokeX, smokeY, smokeSize, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    // Draw car (simple representation)
    function drawCar(car) {
        // Cars are drawn in drawSegment for perspective
    }
    
    // Handle keyboard input
    const keys = {
        ArrowUp: false,
        ArrowDown: false,
        ArrowLeft: false,
        ArrowRight: false,
        ' ': false
    };
    
    document.addEventListener('keydown', (e) => {
        if (keys.hasOwnProperty(e.key)) {
            keys[e.key] = true;
            e.preventDefault();
        }
    });
    
    document.addEventListener('keyup', (e) => {
        if (keys.hasOwnProperty(e.key)) {
            keys[e.key] = false;
            e.preventDefault();
        }
    });
    
    // Process input
    function processInput() {
        if (!raceStarted) return;
        
        // Acceleration
        if (keys.ArrowUp) {
            player.speed += player.acceleration;
        } else {
            player.speed *= 0.98;
        }
        
        // Braking/Reverse
        if (keys.ArrowDown) {
            if (player.speed > 0) {
                player.speed = Math.max(0, player.speed - player.brakingPower);
            } else {
                player.speed = Math.max(-player.reverseSpeed, player.speed - player.deceleration);
            }
        }
        
        // Steering
        if (keys.ArrowLeft) {
            player.steering = Math.max(-player.maxSteering, player.steering - player.steeringSpeed);
        } else if (keys.ArrowRight) {
            player.steering = Math.min(player.maxSteering, player.steering + player.steeringSpeed);
        } else {
            // Center steering when no keys pressed
            player.steering *= 0.9;
        }
        
        // Drifting (handbrake)
        if (keys[' '] && player.speed > 50) {
            player.steering *= 1.5; // Increased steering during drift
            player.speed *= player.driftFactor; // Slight speed reduction
        }
    }
    
    // Start race
    function startRace() {
        startScreen.style.display = 'none';
        raceStarted = true;
    }
    
    // Event listeners
    startButton.addEventListener('click', () => {
        initGame();
        startRace();
    });
    
    // Start the game
    initGame();
    
    // Input processing loop
    setInterval(processInput, 16);
});
