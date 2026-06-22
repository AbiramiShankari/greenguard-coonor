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
import { useTranslation } from 'react-i18next';

const CATEGORY_LABELS = {
  overflow: 'Overflow 🗑️',
  waste_dumping: 'Waste Dumping 🗑️',
  drainage: 'Drainage 🌊',
  litter: 'Litter 🚮',
  dead_animal: 'Dead Animal 💀',
  construction_waste: 'Construction Waste 🏗️',
  other: 'Other 📋',
};

export default function ComplaintNew() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const fileRef = useRef();
  const [form, setForm] = useState({ location: '', city: '', ward: '', description: '' });
  const [image, setImage] = useState(null);
  const [landmarkImage, setLandmarkImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [landmarkImagePreview, setLandmarkImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [duplicateOf, setDuplicateOf] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [coords, setCoords] = useState({ lat: null, lng: null });

  const set = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));

  const handleImageChange = async (sourceTypeOrFile = 'PROMPT') => {
    try {
      let fileToAnalyze;
      if (sourceTypeOrFile instanceof File) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(sourceTypeOrFile.type)) {
          toast.error('Only JPEG, PNG, or WebP images allowed');
          return;
        }
        if (sourceTypeOrFile.size > 5 * 1024 * 1024) {
          toast.error('Image must be under 5MB');
          return;
        }
        setImage(sourceTypeOrFile);
        setImagePreview(URL.createObjectURL(sourceTypeOrFile));
        fileToAnalyze = sourceTypeOrFile;
      } else {
        let source = CameraSource.Prompt;
        if (sourceTypeOrFile === 'CAMERA') source = CameraSource.Camera;
        else if (sourceTypeOrFile === 'GALLERY') source = CameraSource.Photos;

        const photo = await Camera.getPhoto({
          resultType: CameraResultType.Uri,
          source: source,
          quality: 90
        });
        
        const response = await fetch(photo.webPath);
        const blob = await response.blob();
        const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
        
        setImage(file);
        setImagePreview(photo.webPath);
        fileToAnalyze = file;
      }
      
      if (fileToAnalyze) {
        analyzeImage(fileToAnalyze);
      }
    } catch (err) {
      console.error('Camera error:', err);
      if (err.message && !err.message.toLowerCase().includes('cancel')) {
        toast.error('Failed to capture photo');
      }
    }
  };

  const handleLandmarkImageChange = async (sourceTypeOrFile = 'PROMPT') => {
    try {
      if (sourceTypeOrFile instanceof File) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(sourceTypeOrFile.type)) {
          toast.error('Only JPEG, PNG, or WebP images allowed');
          return;
        }
        if (sourceTypeOrFile.size > 5 * 1024 * 1024) {
          toast.error('Image must be under 5MB');
          return;
        }
        setLandmarkImage(sourceTypeOrFile);
        setLandmarkImagePreview(URL.createObjectURL(sourceTypeOrFile));
      } else {
        let source = CameraSource.Prompt;
        if (sourceTypeOrFile === 'CAMERA') source = CameraSource.Camera;
        else if (sourceTypeOrFile === 'GALLERY') source = CameraSource.Photos;

        const photo = await Camera.getPhoto({
          resultType: CameraResultType.Uri,
          source: source,
          quality: 90
        });
        
        const response = await fetch(photo.webPath);
        const blob = await response.blob();
        const file = new File([blob], `landmark_${Date.now()}.jpg`, { type: 'image/jpeg' });
        
        setLandmarkImage(file);
        setLandmarkImagePreview(photo.webPath);
      }
    } catch (err) {
      console.error('Camera error:', err);
      if (err.message && !err.message.toLowerCase().includes('cancel')) {
        toast.error('Failed to capture landmark photo');
      }
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
      if (landmarkImage) formData.append('landmarkImage', landmarkImage);
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
            <h2 style={{ marginBottom: 6 }}>{t('report_waste_issue')}</h2>
            <p style={{ color: 'var(--color-gray-500)', fontSize: 13, marginBottom: 24 }}>
              {t('earn_10_pts')}
            </p>

            <form onSubmit={handleSubmit}>
              {/* Location */}
              <div className="form-group">
                <label className="form-label">{t('location_desc')}</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="form-input" placeholder="E.g. Near bus stop, Race Course Road" value={form.location} onChange={set('location')} required id="complaint-location" />
                  <button type="button" className="btn btn-outline btn-sm" onClick={handleGetLocation} disabled={geoLoading} style={{ whiteSpace: 'nowrap' }}>
                    {geoLoading ? <span className="spinner" /> : t('my_location')}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">{t('city_star')}</label>
                  <select className="form-input" value={form.city} onChange={set('city')} required id="complaint-city">
                    <option value="">{t('select_city')}</option>
                    {CITIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{t('ward_star')}</label>
                  <input className="form-input" placeholder="E.g. Ward 12 - Gandhipuram" value={form.ward} onChange={set('ward')} required id="complaint-ward" />
                </div>
              </div>

              {/* Description */}
              <div className="form-group">
                <label className="form-label">
                  {t('desc_star')} <span style={{ color: 'var(--color-gray-400)', fontWeight: 400 }}>({form.description.length}/min 20)</span>
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
                <span className="form-label">{t('photo_mandatory')}</span>
                <div
                  className={`image-upload-zone ${dragOver ? 'drag-over' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); handleImageChange(e.dataTransfer.files[0]); }}
                  style={{ display: 'block', textAlign: 'center' }}
                >
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" style={{ maxHeight: 180, borderRadius: 8, objectFit: 'cover', cursor: 'pointer' }} onClick={() => handleImageChange('PROMPT')} />
                  ) : (
                    <div style={{ padding: '10px 0' }}>
                      <div style={{ fontSize: 32, marginBottom: 12 }}>📷</div>
                      <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => handleImageChange('CAMERA')}>
                          📷 {t('camera')}
                        </button>
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => handleImageChange('GALLERY')}>
                          🖼️ {t('gallery')}
                        </button>
                        <input type="file" id="hidden-file-input" style={{ display: 'none' }} accept="image/*" onChange={(e) => handleImageChange(e.target.files[0])} />
                      </div>
                    </div>
                  )}
                </div>
                {analyzing && <div style={{ marginTop: 8, fontSize: 13, color: 'var(--color-primary)' }}><span className="spinner" /> Analyzing image with Gemini AI...</div>}
                {aiResult && !analyzing && (
                  <div style={{ marginTop: 8, fontSize: 13, padding: '8px 12px', background: 'var(--color-primary-light)', color: 'var(--color-primary-dark)', borderRadius: 6 }}>
                    <strong>✨ AI Analysis Complete:</strong> Detected <strong>{aiResult.category}</strong> (Priority: {aiResult.priority})
                  </div>
                )}
              </div>
              {/* Landmark Image Upload (Optional) */}
              <div className="form-group">
                <span className="form-label">Nearby Landmark Photo (Optional)</span>
                <div
                  className="image-upload-zone"
                  style={{ display: 'block', textAlign: 'center', minHeight: '120px', padding: '16px' }}
                >
                  {landmarkImagePreview ? (
                    <img src={landmarkImagePreview} alt="Preview" style={{ maxHeight: 180, borderRadius: 8, objectFit: 'cover', cursor: 'pointer' }} onClick={() => handleLandmarkImageChange('PROMPT')} />
                  ) : (
                    <div style={{ padding: '10px 0' }}>
                      <div style={{ fontSize: 32, marginBottom: 12 }}>📸</div>
                      <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => handleLandmarkImageChange('CAMERA')}>
                          📷 {t('camera')}
                        </button>
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => handleLandmarkImageChange('GALLERY')}>
                          🖼️ {t('gallery')}
                        </button>
                        <input type="file" id="hidden-landmark-file-input" style={{ display: 'none' }} accept="image/*" onChange={(e) => handleLandmarkImageChange(e.target.files[0])} />
                      </div>
                    </div>
                  )}
                </div>
                <p style={{ fontSize: 12, color: 'var(--color-gray-500)', marginTop: 4 }}>
                  Help the collector find the exact spot faster!
                </p>
              </div>

              {/* Duplicate Warning */}
              {isDuplicate && (
                <div style={{ background: '#fef9c3', border: '1.5px solid #eab308', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: 16, fontSize: 13 }}>
                  ⚠️ <strong>Similar complaint detected!</strong> Linked to report #{(duplicateOf || '').slice(-8).toUpperCase()}.
                  One fix, double impact — your report has been noted!
                </div>
              )}

              <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading || geoLoading || analyzing} id="complaint-submit">
                {loading ? <><span className="spinner" /> Submitting...</> : analyzing ? <><span className="spinner" /> Analyzing...</> : geoLoading ? <><span className="spinner" /> Location...</> : t('submit_complaint')}
              </button>
            </form>
        </div>
      </div>
    </>
  );
}
