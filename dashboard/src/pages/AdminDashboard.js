import React, { useState } from 'react';
import { useSocket } from '../hooks/useSocket';
import Sidebar from '../layout/Sidebar';
import MapView from '../components/MapView';
import IncidentChart from '../components/IncidentChart';
import IncidentTable from '../components/IncidentTable';
import IncidentCard from '../components/IncidentCard';

const AdminDashboard = () => {
    const [activeTab, setActiveTab] = useState('dashboard');
    const incidents = useSocket();
    const user = JSON.parse(localStorage.getItem('user'));

    return (
        <div className="flex bg-slate-100 min-h-screen">
            <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} user={user} />
            <main className="flex-1 ml-64 p-8">
                <header className="mb-10 bg-gradient-to-r from-blue-800 to-indigo-900 p-8 rounded-[2rem] shadow-2xl text-white">
                    <h1 className="text-3xl font-black">ADMIN COMMAND CENTER</h1>
                    <p className="text-blue-200 text-xs font-bold tracking-[0.3em]">Full System Control | {user?.fullName}</p>
                </header>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-8">
                    <div className="xl:col-span-2 bg-white p-2 rounded-3xl shadow-xl h-[500px]">
                        <MapView incidents={incidents} />
                    </div>
                    <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-slate-100">
                        <h3 className="font-bold text-slate-800 mb-4">System Analytics</h3>
                        <IncidentChart data={incidents} />
                        <div className="mt-6 p-4 bg-blue-50 rounded-2xl">
                            <p className="text-xs font-bold text-blue-600">TOTAL REPORTS</p>
                            <p className="text-3xl font-black text-blue-900">{incidents.length}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-8 rounded-3xl shadow-xl">
                    <h3 className="text-lg font-bold mb-6">Live Incident Management</h3>
                    <IncidentTable data={incidents} isAdmin={true} />
                </div>
            </main>
        </div>
    );
};

export default AdminDashboard;