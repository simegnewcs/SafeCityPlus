import React, { useState } from 'react';
import { useSocket } from '../hooks/useSocket';
import Sidebar from '../layout/Sidebar';
import MapView from '../components/MapView';
import IncidentCard from '../components/IncidentCard';

const ResponderDashboard = () => {
    const [activeTab, setActiveTab] = useState('dashboard');
    const incidents = useSocket();
    const user = JSON.parse(localStorage.getItem('user'));

    // ሪስፖንደሩ ማየት ያለበት ያልተፈቱ (Pending) አደጋዎችን ብቻ ነው
    const pendingIncidents = incidents.filter(inc => inc.status !== 'Resolved');

    return (
        <div className="flex bg-slate-50 min-h-screen">
            <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} user={user} />
            <main className="flex-1 ml-64 p-8">
                <header className="mb-10 bg-gradient-to-r from-red-600 to-orange-600 p-8 rounded-[2rem] shadow-xl text-white">
                    <h1 className="text-3xl font-black">RESPONDER PORTAL</h1>
                    <p className="text-red-100 text-xs font-bold tracking-[0.3em]">Active Emergencies | Field Unit: {user?.fullName}</p>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-white p-2 rounded-3xl shadow-lg h-[450px]">
                        <h3 className="p-4 font-bold text-slate-700">Nearby Incidents</h3>
                        <MapView incidents={pendingIncidents} />
                    </div>

                    <div className="space-y-4">
                        <h3 className="font-bold text-slate-800 text-xl">Urgent Tasks</h3>
                        <div className="grid grid-cols-1 gap-4 overflow-y-auto max-h-[500px] pr-2">
                            {pendingIncidents.length > 0 ? (
                                pendingIncidents.map(inc => (
                                    <IncidentCard key={inc.id} incident={inc} isResponder={true} />
                                ))
                            ) : (
                                <div className="bg-green-100 p-10 rounded-3xl text-center">
                                    <p className="text-green-700 font-bold">All Clear! No pending emergencies.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default ResponderDashboard;