import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Phone,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  AlertCircle,
  CheckCircle,
  Menu
} from "lucide-react";
import AdminSidebar from "../layout/AdminSidebar";

const API_URL = "http://10.161.68.44:5000/api";

const AdminContacts = () => {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingContact, setEditingContact] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const user = JSON.parse(localStorage.getItem("user"));
  const [draggedItem, setDraggedItem] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    number: "",
    alternative: "",
    icon: "call",
    color: "#E63939",
    description: ""
  });

  const iconOptions = [
    { value: "call", label: "Phone" },
    { value: "shield-checkmark", label: "Police" },
    { value: "medkit", label: "Medical" },
    { value: "flame", label: "Fire" },
    { value: "car", label: "Traffic" },
    { value: "flash", label: "Electricity" },
    { value: "alert-circle", label: "Alert" },
    { value: "help-circle", label: "Help" }
  ];

  const colorOptions = [
    { value: "#3b82f6", label: "Blue" },
    { value: "#ef4444", label: "Red" },
    { value: "#f59e0b", label: "Amber" },
    { value: "#10b981", label: "Green" },
    { value: "#8b5cf6", label: "Purple" },
    { value: "#E63939", label: "Coral" },
    { value: "#64748b", label: "Slate" }
  ];

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/emergency-contacts`);
      setContacts(response.data);
      setError("");
    } catch (err) {
      setError("Failed to fetch emergency contacts");
      console.error("Error fetching contacts:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddContact = async (e) => {
    e.preventDefault();
    try {
      const user = JSON.parse(localStorage.getItem("user"));
      const config = {
        headers: {
          'Authorization': `Bearer ${user?.id}`,
          'Content-Type': 'application/json'
        }
      };
      await axios.post(`${API_URL}/emergency-contacts`, formData, config);
      setSuccess("Emergency contact added successfully");
      setShowAddForm(false);
      resetForm();
      fetchContacts();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to add contact");
      setTimeout(() => setError(""), 3000);
    }
  };

  const handleUpdateContact = async (e) => {
    e.preventDefault();
    try {
      const user = JSON.parse(localStorage.getItem("user"));
      const config = {
        headers: {
          'Authorization': `Bearer ${user?.id}`,
          'Content-Type': 'application/json'
        }
      };
      await axios.put(`${API_URL}/emergency-contacts/${editingContact.id}`, formData, config);
      setSuccess("Emergency contact updated successfully");
      setEditingContact(null);
      resetForm();
      fetchContacts();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update contact");
      setTimeout(() => setError(""), 3000);
    }
  };

  const handleDeleteContact = async (id) => {
    if (!window.confirm("Are you sure you want to delete this emergency contact?")) {
      return;
    }
    try {
      const user = JSON.parse(localStorage.getItem("user"));
      const config = {
        headers: {
          'Authorization': `Bearer ${user?.id}`,
          'Content-Type': 'application/json'
        }
      };
      await axios.delete(`${API_URL}/emergency-contacts/${id}`, config);
      setSuccess("Emergency contact deleted successfully");
      fetchContacts();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError("Failed to delete contact");
      setTimeout(() => setError(""), 3000);
    }
  };

  const handleEdit = (contact) => {
    setEditingContact(contact);
    setFormData(contact);
    setShowAddForm(false);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      number: "",
      alternative: "",
      icon: "call",
      color: "#E63939",
      description: ""
    });
  };

  const handleDragStart = (e, index) => {
    setDraggedItem(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e, dropIndex) => {
    e.preventDefault();
    if (draggedItem === null) return;

    const draggedContact = contacts[draggedItem];
    const newContacts = [...contacts];
    newContacts.splice(draggedItem, 1);
    newContacts.splice(dropIndex, 0, draggedContact);

    // Update priorities
    const reorderedContacts = newContacts.map((contact, index) => ({
      ...contact,
      priority: index + 1
    }));

    try {
      await axios.put(`${API_URL}/emergency-contacts/reorder`, {
        contacts: reorderedContacts.map(c => ({ id: c.id, priority: c.priority }))
      });
      setContacts(reorderedContacts);
      setSuccess("Contacts reordered successfully");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError("Failed to reorder contacts");
      setTimeout(() => setError(""), 3000);
    }

    setDraggedItem(null);
  };

  const ContactForm = ({ isEdit = false }) => (
    <div className="bg-zinc-800 rounded-xl p-6 mb-6 border border-zinc-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">
          {isEdit ? "Edit Emergency Contact" : "Add New Emergency Contact"}
        </h3>
        <button
          onClick={() => {
            setShowAddForm(false);
            setEditingContact(null);
            resetForm();
          }}
          className="text-zinc-400 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      <form onSubmit={isEdit ? handleUpdateContact : handleAddContact} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">
              Contact Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Police"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">
              Phone Number *
            </label>
            <input
              type="tel"
              required
              value={formData.number}
              onChange={(e) => setFormData({ ...formData, number: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., 911"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">
              Alternative Number
            </label>
            <input
              type="tel"
              value={formData.alternative}
              onChange={(e) => setFormData({ ...formData, alternative: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., 991"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">
              Icon
            </label>
            <select
              value={formData.icon}
              onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {iconOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">
              Color
            </label>
            <select
              value={formData.color}
              onChange={(e) => setFormData({ ...formData, color: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {colorOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

                  </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Brief description of this emergency service"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Save size={16} />
            {isEdit ? "Update Contact" : "Add Contact"}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowAddForm(false);
              setEditingContact(null);
              resetForm();
            }}
            className="px-4 py-2 bg-zinc-600 text-white rounded-lg hover:bg-zinc-700 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden font-sans">

      {/* ── Sidebar ── */}
      <div className={`${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
                      md:translate-x-0 fixed md:static inset-y-0 left-0 z-50
                      transition-transform duration-300 ease-in-out shadow-xl md:shadow-none`}>
        <AdminSidebar user={user} onClose={() => setSidebarOpen(false)} />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ── Top Header ── */}
        <header className="h-16 bg-white/80 backdrop-blur border-b border-slate-200 px-6 flex items-center justify-between z-40 sticky top-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden p-2 hover:bg-slate-100 rounded-xl transition-colors">
              {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900 leading-none">Emergency Contacts</h1>
              <p className="text-[11px] text-slate-400 mt-0.5 font-medium">
                Manage emergency contact numbers displayed in the mobile app
              </p>
            </div>
          </div>
        </header>

        {/* ── Main Content ── */}
        <main className="flex-1 overflow-y-auto bg-slate-50 p-6">

          {/* Alert Messages */}
          {error && (
            <div className="mb-4 flex items-center gap-2 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-200">
              <AlertCircle size={18} />
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 flex items-center gap-2 p-3 bg-green-900/50 border border-green-700 rounded-lg text-green-200">
              <CheckCircle size={18} />
              {success}
            </div>
          )}

          {/* Add Button */}
          {!showAddForm && !editingContact && (
            <button
              onClick={() => setShowAddForm(true)}
              className="mb-6 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={18} />
              Add Emergency Contact
            </button>
          )}

          {/* Add/Edit Form */}
          {(showAddForm || editingContact) && <ContactForm isEdit={!!editingContact} />}

          {/* Contacts List */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            {loading ? (
              <div className="p-8 text-center text-slate-400">
                Loading emergency contacts...
              </div>
            ) : contacts.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <Phone size={48} className="mx-auto mb-4 opacity-50" />
                <p>No emergency contacts configured</p>
                <p className="text-sm mt-2">Add emergency contacts to display them in the mobile app</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {contacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="p-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: `${contact.color}20` }}
                      >
                        <Phone size={20} style={{ color: contact.color }} />
                      </div>

                      <div className="flex-1">
                        <h3 className="font-semibold text-slate-900 mb-1">{contact.name}</h3>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-slate-600">
                            <span className="text-slate-400">Main:</span> {contact.number}
                          </span>
                          {contact.alternative && (
                            <span className="text-slate-600">
                              <span className="text-slate-400">Alt:</span> {contact.alternative}
                            </span>
                          )}
                        </div>
                        {contact.description && (
                          <p className="text-sm text-slate-400 mt-1">{contact.description}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(contact)}
                          className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-100 rounded-lg transition-all"
                          title="Edit contact"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDeleteContact(contact.id)}
                          className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-100 rounded-lg transition-all"
                          title="Delete contact"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </main>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          onClick={() => setSidebarOpen(false)} />
      )}
    </div>
  );
};

export default AdminContacts;
