
import { io } from 'socket.io-client';

async function runTest() {
    console.log("1. Logging in as SUPER_ADMIN...");
    let res = await fetch('http://localhost:5000/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@dropzone.com', password: 'DropzoneAdmin2026!' })
    });
    let data = await res.json();
    if (!data.success) throw new Error("Admin login failed");
    const adminToken = data.data.accessToken;
    console.log("Admin login success. Token:", adminToken.substring(0, 15) + "...");

    console.log("\n2. Creating new DRIVER user...");
    let warehouseRes = await fetch('http://localhost:5000/api/v1/warehouses');
    let warehouseData = await warehouseRes.json();
    let warehouseId = warehouseData.success && warehouseData.data.length > 0 ? warehouseData.data[0]._id : "60b8d295f1d293001594e9f1";

    res = await fetch('http://localhost:5000/api/v1/users', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
            name: "John Driver",
            email: "john@dropzone.com",
            phone: "555-1234",
            role: "DRIVER",
            password: "password123",
            assignedWarehouse: warehouseId
        })
    });
    data = await res.json();
    // It might conflict if we run this twice, handle 409
    if (!res.ok && res.status !== 409) throw new Error("Failed to create driver: " + JSON.stringify(data));
    console.log("Driver user created or already exists.");

    console.log("\n3. Logging in as DRIVER...");
    res = await fetch('http://localhost:5000/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'john@dropzone.com', password: 'password123' })
    });
    data = await res.json();
    if (!data.success) throw new Error("Driver login failed");
    const driverToken = data.data.accessToken;
    const driverId = data.data.user.id;
    console.log("Driver login success. Token:", driverToken.substring(0, 15) + "..., ID:", driverId);

    console.log("\n4. Connecting Driver Socket...");
    const socket = io('http://localhost:5000', {
        auth: {
            token: driverToken,
            warehouseId: 'W1'
        }
    });

    return new Promise((resolve, reject) => {
        socket.on('connect', () => {
            console.log(`Socket connected successfully with ID: ${socket.id}`);
            socket.disconnect();
            resolve();
        });

        socket.on('connect_error', (err) => {
            console.error("Socket connection failed:", err.message);
            reject(err);
        });
        
        setTimeout(() => reject(new Error("Socket timeout")), 5000);
    });
}

runTest().then(() => console.log("\nALL TESTS PASSED!")).catch(console.error);
