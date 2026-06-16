import { io } from 'socket.io-client';

const socket = io('http://localhost:5000', {
    auth: {
        token: 'mock_driver_token_123',
        driverId: 'DRV-TEST',
        warehouseId: 'WH-TEST'
    }
});

socket.on('connect', () => {
    console.log('Connected! Simulating handoff...');
    socket.emit('driver:handoff_to_server', {
        driverId: 'DRV-TEST',
        currentRoute: {
            crisisId: 'some-crisis',
            origin: { lat: 0, lng: 0 },
            destination: { lat: 1, lng: 1 }
        },
        simulatedRoutePath: [[0,0], [1,1]],
        isReturning: false,
        currentPosition: { lat: 0, lng: 0 }
    });
    
    setTimeout(() => {
        socket.disconnect();
        console.log('Disconnected.');
        
        // Now simulate reconnecting
        console.log('Reconnecting...');
        const socket2 = io('http://localhost:5000', {
            auth: {
                token: 'mock_driver_token_123',
                driverId: 'DRV-TEST',
                warehouseId: 'WH-TEST'
            }
        });
        
        socket2.on('connect', () => {
            console.log('Reconnected!');
        });
        
        socket2.on('server:sim_resume', (data) => {
            console.log('SUCCESS! Received server:sim_resume!', data);
            process.exit(0);
        });
        
        setTimeout(() => {
            console.log('FAILED! Did not receive server:sim_resume after 2 seconds.');
            process.exit(1);
        }, 2000);
        
    }, 500);
});
