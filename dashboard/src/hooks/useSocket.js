import { useEffect, useState } from 'react';
import io from 'socket.io-client';

const socket = io('http://localhost:5000');

export const useSocket = () => {
    const [incidents, setIncidents] = useState([]);

    useEffect(() => {
        fetch('http://localhost:5000/api/incidents')
            .then(res => res.json())
            .then(data => setIncidents(data))
            .catch(err => console.error("Fetch Error:", err));

        socket.on('new_incident', (data) => {
            setIncidents((prev) => [data, ...prev]);
        });

        return () => socket.off('new_incident');
    }, []);

    return incidents;
};