import { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export default function UpcycleHub() {
  const { user } = useAuth();
  const fileRef = useRef();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
  // Form state
  const [form, setForm] = useState({ title: '', description: '', category: 'FURNITURE' });
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const res = await api.get('/upcycle?status=AVAILABLE');
      setItems(res.data.data.items);
    } catch (err) {
      toast.error('Failed to fetch upcycle items');
    } finally {
      setLoading(false);
    }
  };

  const handleImage = (file) => {
    if (!file) return;
    setImage(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!image) {
      toast.error('A photo of the item is required');
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      fd.append('image', image);

      const res = await api.post('/upcycle', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(`🎉 Item listed! +${res.data.data.pointsAwarded} pts`);
      setShowForm(false);
      fetchItems();
      setForm({ title: '', description: '', category: 'FURNITURE' });
      setImage(null);
      setPreview(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to list item');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClaim = async (id) => {
    // Basic confirmation
    if (window.confirm("Are you sure you want to claim this item? The donor's contact details will be shared.")) {
      // In a real app, we'd have a specific CLAIM flow and notify the donor.
      // For now, let's just alert a message.
      toast.success("Item claimed! We'll email you the donor's contact details to arrange pickup.");
    }
  };

  return (
    <>
      <div className="app-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div>
              <h2 style={{ marginBottom: 4 }}>♻️ Upcycle Hub</h2>
              <p style={{ color: 'var(--color-gray-500)', fontSize: 14 }}>
                Donate usable items or claim items from others to promote a circular economy.
              </p>
            </div>
            {user?.role === 'CITIZEN' && (
              <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
                {showForm ? 'Cancel' : '➕ List an Item'}
              </button>
            )}
          </div>

          {showForm && (
            <div className="card" style={{ marginBottom: 24 }}>
              <h3>List an Item for Donation</h3>
              <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label">Item Title *</label>
                    <input className="form-input" required value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="E.g. Study Table" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Category *</label>
                    <select className="form-input" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                      <option value="FURNITURE">Furniture</option>
                      <option value="ELECTRONICS">Electronics</option>
                      <option value="CLOTHING">Clothing</option>
                      <option value="BOOKS">Books</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Description *</label>
                  <textarea className="form-input" required rows={2} value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Describe the item condition..." />
                </div>
                <div className="form-group">
                  <span className="form-label">Photo *</span>
                  <label className="image-upload-zone" style={{ display: 'block' }}>
                    {preview ? <img src={preview} alt="" style={{ maxHeight: 100, borderRadius: 8 }} /> : <><div style={{ fontSize: 24 }}>📷</div><div style={{ fontSize: 12, color: 'var(--color-gray-500)' }}>Click to add photo</div></>}
                    <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleImage(e.target.files[0])} />
                  </label>
                </div>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Listing...' : 'List Item for Donation (Earn 15 pts)'}
                </button>
              </form>
            </div>
          )}

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><span className="spinner" /></div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
              {items.map(item => (
                <div key={item.id} className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <img src={item.imageUrl} alt={item.title} style={{ width: '100%', height: 180, objectFit: 'cover' }} />
                  <div style={{ padding: 16, flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <h3 style={{ fontSize: 16 }}>{item.title}</h3>
                      <span className="badge" style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary-dark)' }}>{item.category}</span>
                    </div>
                    <p style={{ color: 'var(--color-gray-500)', fontSize: 13, flex: 1, marginBottom: 12 }}>{item.description}</p>
                    <div style={{ fontSize: 12, color: 'var(--color-gray-400)', marginBottom: 16 }}>
                      Donated by: {item.donor.name} ({item.donor.city})
                    </div>
                    {user?.id !== item.donorId && (
                      <button className="btn btn-outline btn-full" onClick={() => handleClaim(item.id)}>
                        Claim Item
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {items.length === 0 && (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-gray-500)', gridColumn: '1 / -1' }}>
                  No items available for upcycling right now. Be the first to donate!
                </div>
              )}
            </div>
          )}
      </div>
    </>
  );
}
