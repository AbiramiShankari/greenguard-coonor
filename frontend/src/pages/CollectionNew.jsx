// GreenGuard — Collection New Page (Pickup Request)
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { WASTE_TYPES } from '../utils/constants';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { MapContainer, TileLayer, CircleMarker, useMapEvents } from 'react-leaflet';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

function MapEvents({ onPin }) {
  useMapEvents({
    click(e) {
      onPin(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function CollectionNew() {
  const navigate = useNavigate();
  const fileRef = useRef();
  const [wasteType, setWasteType] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState({ lat: null, lng: null });
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);

  const handlePinLocation = async (latitude, longitude) => {
    setCoords({ lat: latitude, lng: longitude });
    setGeoLoading(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`);
      if (res.ok) {
        const data = await res.json();
        const displayName = data.display_name || '';
        if (displayName) {
          setAddress(displayName);
          toast.success('Address updated from map pin!');
        }
      }
    } catch (err) {
      console.error('Error fetching address:', err);
      setAddress(`Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}`);
    } finally {
      setGeoLoading(false);
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
      handlePinLocation(lat, lng);
      toast.success('Location pinned!');
    } catch (err) {
      console.error('Location error:', err);
      toast.error('Could not get location');
    } finally {
      setGeoLoading(false);
    }
  };



  const handleImage = async (fileOrEvent) => {
    try {
      if (Capacitor.isNativePlatform()) {
        const photo = await Camera.getPhoto({
          resultType: CameraResultType.Uri,
          source: CameraSource.Camera,
          quality: 90
        });
        
        const response = await fetch(photo.webPath);
        const blob = await response.blob();
        const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
        
        setImage(file);
        setPreview(photo.webPath);
      } else {
        const file = fileOrEvent?.target?.files?.[0] || fileOrEvent;
        if (!file) return;
        setImage(file);
        setPreview(URL.createObjectURL(file));
      }
    } catch (err) {
      console.error('Camera error:', err);
      toast.error('Failed to capture photo');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!wasteType) { toast.error('Please select waste type'); return; }
    if (!quantity || isNaN(parseFloat(quantity)) || parseFloat(quantity) <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }
    if (!image) {
      toast.error('A photo of the waste is mandatory.');
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('wasteType', wasteType);
      fd.append('quantity', quantity);
      fd.append('address', address);
      if (coords.lat) fd.append('lat', coords.lat);
      if (coords.lng) fd.append('lng', coords.lng);
      if (image) fd.append('image', image);

      const res = await api.post('/collections', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(`♻️ Pickup requested! +${res.data.data.pointsAwarded || 5} pts`);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="app-content" style={{ maxWidth: 680, margin: '0 auto' }}>
        <div className="card">
            <h2 style={{ marginBottom: 6 }}>♻️ Request Waste Pickup</h2>
            <p style={{ color: 'var(--color-gray-500)', fontSize: 13, marginBottom: 24 }}>
              Schedule a pickup for segregated waste. Earn 5 pts + 15 pts on completion!
            </p>
            <form onSubmit={handleSubmit}>
              {/* Waste Type Selector */}
              <div className="form-group">
                <label className="form-label">Waste Type *</label>
                <div style={{ color: 'var(--color-red)', fontSize: 12, marginTop: -4, marginBottom: 12, fontWeight: 500 }}>
                  ⚠️ Note: Biomedical, toxic, and hazardous wastes are strictly not accepted.
                </div>
                <div className="waste-type-grid">
                  {WASTE_TYPES.filter(wt => wt.id !== 'HAZARDOUS' && wt.id !== 'MIXED').map(wt => (
                    <div
                      key={wt.id}
                      className={`waste-type-card ${wasteType === wt.id ? 'selected' : ''}`}
                      onClick={() => setWasteType(wt.id)}
                      id={`waste-${wt.id}`}
                    >
                      <span className="waste-type-icon">{wt.icon}</span>
                      <span className="waste-type-label">{wt.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quantity */}
              <div className="form-group">
                <label className="form-label">Quantity (kg) *</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button type="button" className="btn btn-outline" style={{ width: 40, height: 40, padding: 0 }} onClick={() => setQuantity(q => Math.max(0.5, (parseFloat(q) || 0) - 0.5))}>−</button>
                  <input
                    type="number"
                    className="form-input"
                    style={{ width: 100, textAlign: 'center' }}
                    value={quantity}
                    min="0.5"
                    step="0.5"
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '') {
                        setQuantity('');
                      } else {
                        const parsed = parseFloat(val);
                        if (!isNaN(parsed)) setQuantity(parsed);
                      }
                    }}
                    id="collection-quantity"
                  />
                  <button type="button" className="btn btn-outline" style={{ width: 40, height: 40, padding: 0 }} onClick={() => setQuantity(q => (parseFloat(q) || 0) + 0.5)}>+</button>
                  <span style={{ color: 'var(--color-gray-500)', fontSize: 13 }}>kg estimated</span>
                </div>
              </div>

              {/* Address */}
              <div className="form-group">
                <label className="form-label">Pickup Address *</label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <input className="form-input" placeholder="Full address for pickup" value={address} onChange={e => setAddress(e.target.value)} required id="collection-address" />
                  <button type="button" className="btn btn-outline btn-sm" onClick={handleGetLocation} disabled={geoLoading} style={{ whiteSpace: 'nowrap' }}>
                    {geoLoading ? <span className="spinner" /> : '📍 Fetch'}
                  </button>
                </div>

                <div style={{ height: 200, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--color-gray-200)', marginBottom: 6 }}>
                  <MapContainer
                    key={`${coords.lat || 11.3530}-${coords.lng || 76.7959}`}
                    center={coords.lat ? [coords.lat, coords.lng] : [11.3530, 76.7959]}
                    zoom={coords.lat ? 16 : 14}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    {coords.lat && coords.lng && (
                      <CircleMarker
                        center={[coords.lat, coords.lng]}
                        radius={10}
                        pathOptions={{ color: 'var(--color-primary)', fillColor: 'var(--color-primary-light)', fillOpacity: 0.8 }}
                      />
                    )}
                    <MapEvents onPin={handlePinLocation} />
                  </MapContainer>
                </div>
                <p style={{ fontSize: 11, color: 'var(--color-gray-500)' }}>
                  Click on the map to pin your exact pickup location.
                </p>
                {coords.lat && <div style={{ fontSize: 11, color: 'var(--color-primary)', marginTop: 4 }}>📍 Location pinned: {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}</div>}
              </div>

              {/* Photo */}
              <div className="form-group">
                <span className="form-label">Photo * (Mandatory for collection)</span>
                <label className="image-upload-zone" style={{ display: 'block' }}>
                  {preview ? (
                    <img src={preview} alt="Preview" style={{ maxHeight: 140, borderRadius: 8, objectFit: 'cover' }} onClick={() => Capacitor.isNativePlatform() && handleImage()} />
                  ) : (
                    <div onClick={() => Capacitor.isNativePlatform() && handleImage()} style={{ cursor: 'pointer' }}>
                      <div style={{ fontSize: 28 }}>📷</div>
                      <div style={{ fontSize: 13, color: 'var(--color-gray-500)', marginTop: 6 }}>Tap or click to add photo</div>
                      <div style={{ fontSize: 11, color: 'var(--color-gray-400)', marginTop: 4 }}>Native Camera / Gallery</div>
                    </div>
                  )}
                  {!Capacitor.isNativePlatform() && <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImage} />}
                </label>
              </div>

              <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading} id="collection-submit">
                {loading ? <><span className="spinner" /> Submitting...</> : '📦 Request Pickup'}
              </button>
            </form>
        </div>
      </div>
    </>
  );
}
