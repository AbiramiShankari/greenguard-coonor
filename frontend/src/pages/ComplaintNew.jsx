// GreenGuard — Complaint Submission Form
// Full pipeline: image upload → AI category card → duplicate warning

import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { CITIES } from '../utils/constants';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { formatConfidence } from '../utils/format';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

const CATEGORY_LABELS = {
  overflow: 'Overflow 🗑️',
  illegal_dumping: 'Illegal Dumping 🚫',
  drainage: 'Drainage 🌊',
  litter: 'Litter 🚮',
  dead_animal: 'Dead Animal 💀',
  construction_waste: 'Construction Waste 🏗️',
  other: 'Other 📋',
};

export default function ComplaintNew() {
  const navigate = useNavigate();
  const fileRef = useRef();
  const [form, setForm] = useState({ location: '', city: '', ward: '', description: '' });
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [duplicateOf, setDuplicateOf] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [coords, setCoords] = useState({ lat: null, lng: null });

  const set = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));

  const handleImageChange = async (fileOrEvent) => {
    try {
      let fileToAnalyze;
      if (Capacitor.isNativePlatform()) {
        const photo = await Camera.getPhoto({
          resultType: CameraResultType.Uri,
          source: CameraSource.Camera,
          quality: 90
        });
        
        // Fetch the blob from the URI
        const response = await fetch(photo.webPath);
        const blob = await response.blob();
        const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
        
        setImage(file);
        setImagePreview(photo.webPath);
        fileToAnalyze = file;
      } else {
        // Fallback to web input
        const file = fileOrEvent?.target?.files?.[0] || fileOrEvent;
        if (!file) return;
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
          toast.error('Only JPEG, PNG, or WebP images allowed');
          return;
        }
        if (file.size > 5 * 1024 * 1024) {
          toast.error('Image must be under 5MB');
          return;
        }
        setImage(file);
        setImagePreview(URL.createObjectURL(file));
        fileToAnalyze = file;
      }
      
      // Analyze Image
      if (fileToAnalyze) {
        analyzeImage(fileToAnalyze);
      }
    } catch (err) {
      console.error('Camera error:', err);
      toast.error('Failed to capture photo');
    }
  };

  const analyzeImage = async (file) => {
    setAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      if (coords.lat) {
        formData.append('lat', coords.lat);
        formData.append('lng', coords.lng);
      }
      
      const res = await api.post('/ai/analyze-image', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      const { category, priority, descriptionSuggestion, duplicateWarning } = res.data.data;
      
      setForm(p => ({
        ...p,
        description: p.description || descriptionSuggestion
      }));
      setAiResult({ category, priority });
      setIsDuplicate(duplicateWarning);
      
      toast.success('AI successfully analyzed the image!');
    } catch (err) {
      console.error('AI Analysis failed:', err);
      toast.error('AI Analysis failed, but you can still submit.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleGetLocation = async () => {
    setGeoLoading(true);
    try {
      let lat, lng;
      if (Capacitor.isNativePlatform()) {
        const permission = await Geolocation.checkPermissions();
        if (permission.location !== 'granted') {
          await Geolocation.requestPermissions();
        }
        const position = await Geolocation.getCurrentPosition();
        lat = position.coords.latitude;
        lng = position.coords.longitude;
      } else {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      }

      setCoords({ lat, lng });
      
      // Reverse Geocoding using OpenStreetMap Nominatim
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      const data = await res.json();
      const street = data.address?.road || data.address?.suburb || 'Unknown Street';
      const city = data.address?.city || data.address?.town || data.address?.village || '';
      
      setForm(p => ({ 
        ...p, 
        location: `${street}, Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`,
        city: CITIES.includes(city) ? city : p.city 
      }));
      toast.success('Location & street detected!');
    } catch (err) {
      console.error('Location error:', err);
      if (coords.lat) {
        setForm(p => ({ ...p, location: `Lat: ${coords.lat.toFixed(4)}, Lng: ${coords.lng.toFixed(4)}` }));
        toast.success('Location detected (GPS only)!');
      } else {
        toast.error('Could not get location');
      }
    } finally {
      setGeoLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.description.length < 20) {
      toast.error('Description must be at least 20 characters');
      return;
    }
    if (!image) {
      toast.error('A photo of the waste is mandatory.');
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([k, v]) => formData.append(k, v));
      if (coords.lat) formData.append('lat', coords.lat);
      if (coords.lng) formData.append('lng', coords.lng);
      if (image) formData.append('image', image);
      if (aiResult) {
        formData.append('category', aiResult.category);
        formData.append('priority', aiResult.priority);
      }

      const res = await api.post('/complaints', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      const data = res.data.data;

      if (data.isDuplicate) {
        toast('⚠️ Similar report already exists — linked!', { icon: '🔁' });
      } else {
        toast.success(`✅ Complaint submitted! +${data.pointsAwarded} pts`);
      }
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="app-content" style={{ maxWidth: 700, margin: '0 auto' }}>
        <div className="card">
            <h2 style={{ marginBottom: 6 }}>🗑️ Report Waste Issue</h2>
            <p style={{ color: 'var(--color-gray-500)', fontSize: 13, marginBottom: 24 }}>
              Submit a complaint. Earn 10 pts!
            </p>

            <form onSubmit={handleSubmit}>
              {/* Location */}
              <div className="form-group">
                <label className="form-label">Location Description *</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="form-input" placeholder="E.g. Near bus stop, Race Course Road" value={form.location} onChange={set('location')} required id="complaint-location" />
                  <button type="button" className="btn btn-outline btn-sm" onClick={handleGetLocation} disabled={geoLoading} style={{ whiteSpace: 'nowrap' }}>
                    {geoLoading ? <span className="spinner" /> : '📍 My Location'}
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">City *</label>
                  <select className="form-input" value={form.city} onChange={set('city')} required id="complaint-city">
                    <option value="">Select city...</option>
                    {CITIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Ward *</label>
                  <input className="form-input" placeholder="E.g. Ward 12 - Gandhipuram" value={form.ward} onChange={set('ward')} required id="complaint-ward" />
                </div>
              </div>

              {/* Description */}
              <div className="form-group">
                <label className="form-label">
                  Description * <span style={{ color: 'var(--color-gray-400)', fontWeight: 400 }}>({form.description.length}/min 20)</span>
                </label>
                <textarea
                  className="form-input"
                  rows={4}
                  placeholder="Describe the waste issue in detail..."
                  value={form.description}
                  onChange={set('description')}
                  required
                  id="complaint-description"
                  style={{ resize: 'vertical' }}
                />
              </div>

              {/* Image Upload (Mandatory) */}
              <div className="form-group">
                <span className="form-label">Photo * (Mandatory for AI verification)</span>
                <label
                  className={`image-upload-zone ${dragOver ? 'drag-over' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); handleImageChange(e.dataTransfer.files[0]); }}
                  style={{ display: 'block' }}
                >
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" style={{ maxHeight: 180, borderRadius: 8, objectFit: 'cover' }} onClick={() => Capacitor.isNativePlatform() && handleImageChange()} />
                  ) : (
                    <div onClick={() => Capacitor.isNativePlatform() && handleImageChange()} style={{ cursor: 'pointer' }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>📷</div>
                      <div style={{ fontSize: 13, color: 'var(--color-gray-500)' }}>Tap or click to add photo</div>
                      <div style={{ fontSize: 11, color: 'var(--color-gray-400)', marginTop: 4 }}>Native Camera / Gallery</div>
                    </div>
                  )}
                  {!Capacitor.isNativePlatform() && <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handleImageChange} />}
                </label>
                {analyzing && <div style={{ marginTop: 8, fontSize: 13, color: 'var(--color-primary)' }}><span className="spinner" /> Analyzing image with Gemini AI...</div>}
                {aiResult && !analyzing && (
                  <div style={{ marginTop: 8, fontSize: 13, padding: '8px 12px', background: 'var(--color-primary-light)', color: 'var(--color-primary-dark)', borderRadius: 6 }}>
                    <strong>✨ AI Analysis Complete:</strong> Detected <strong>{aiResult.category}</strong> (Priority: {aiResult.priority})
                  </div>
                )}
              </div>

              {/* Duplicate Warning */}
              {isDuplicate && (
                <div style={{ background: '#fef9c3', border: '1.5px solid #eab308', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: 16, fontSize: 13 }}>
                  ⚠️ <strong>Similar complaint detected!</strong> Linked to report #{(duplicateOf || '').slice(-8).toUpperCase()}.
                  One fix, double impact — your report has been noted!
                </div>
              )}

              <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading} id="complaint-submit">
                {loading ? <><span className="spinner" /> Submitting...</> : '🚀 Submit Complaint'}
              </button>
            </form>
        </div>
      </div>
    </>
  );
}
