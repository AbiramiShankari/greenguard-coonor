// GreenGuard — Leaflet Map Page
// Complaint markers, collection pins, heatmap layer, live filter sidebar

import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, LayerGroup } from 'react-leaflet';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { MARKER_COLORS, CITIES } from '../utils/constants';
import { truncate, timeAgo, getCategoryClass, getPriorityClass } from '../utils/format';

const LAYER_OPTIONS = ['Complaints', 'Collections', 'Smart Bins', 'Clean Spots', 'Heatmap'];

export default function MapView() {
  const [markers, setMarkers] = useState([]);
  const [collections, setCollections] = useState([]);
  const [smartBins, setSmartBins] = useState([]);
  const [activeLayer, setActiveLayer] = useState('Complaints');
  const [filters, setFilters] = useState({ city: '', status: '', category: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([, v]) => v)));
        if (activeLayer === 'Complaints' || activeLayer === 'Heatmap' || activeLayer === 'Clean Spots') {
          if (activeLayer === 'Clean Spots') params.append('status', 'RESOLVED');
          const res = await api.get(`/map/complaints?${params}`);
          setMarkers(res.data.data.markers);
        } else if (activeLayer === 'Collections') {
          const res = await api.get('/map/collections');
          setCollections(res.data.data.collections);
        } else if (activeLayer === 'Smart Bins') {
          const res = await api.get('/iot/bins');
          setSmartBins(res.data.data.bins);
        }
      } catch { toast.error('Failed to load map data'); }
      finally { setLoading(false); }
    };
    fetch();
  }, [activeLayer, filters]);

  const centerCoords = {
    'Bedford': [11.3601, 76.7932],
    'Brooklands': [11.3630, 76.8010],
    'Grey Hills': [11.3520, 76.8020],
    'Church Hill': [11.3545, 76.7925],
    'Alwarpet': [11.3562, 76.7820],
    'Tiger Hill': [11.3595, 76.8120],
    'Mount Pleasant': [11.3620, 76.7970],
    "Walker's Hill": [11.3510, 76.7910],
    'Singara': [11.3320, 76.8150],
    'Springfield': [11.3500, 76.7800],
    'Yedapalli': [11.3780, 76.7990],
    'Wellington': [11.3653, 76.7865],
    'Ketti': [11.3850, 76.7380],
    'Adikaratti': [11.3670, 76.7450],
    'Huligal': [11.3480, 76.8320],
    'Bandishola': [11.3590, 76.8115],
    'Bearhatty': [11.4110, 76.7900],
    'Burliar': [11.3350, 76.8400],
    'Hubbathalai': [11.3720, 76.7750],
    'Melur': [11.3120, 76.7850]
  };
  const mapCenter = filters.city ? (centerCoords[filters.city] || [11.3530, 76.7959]) : [11.3530, 76.7959];

  return (
    <>
      <div style={{ display: 'flex', height: 'calc(100vh - var(--header-height))' }}>
        {/* Filter Panel */}
          <div style={{ width: 240, background: 'white', borderRight: '1px solid var(--color-gray-200)', padding: 16, overflowY: 'auto', flexShrink: 0 }}>
            <h4 style={{ marginBottom: 12 }}>Map Layers</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
              {LAYER_OPTIONS.map(l => (
                <button
                  key={l}
                  className={`btn ${activeLayer === l ? 'btn-primary' : 'btn-ghost'} btn-sm`}
                  style={{ justifyContent: 'flex-start' }}
                  onClick={() => setActiveLayer(l)}
                >
                  {l === 'Complaints' ? '🗑️' : l === 'Collections' ? '♻️' : l === 'Smart Bins' ? '📡' : l === 'Clean Spots' ? '✅' : '🔥'} {l}
                </button>
              ))}
            </div>

            <h4 style={{ marginBottom: 12 }}>Filters</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <select className="form-input" value={filters.city} onChange={e => setFilters(p => ({ ...p, city: e.target.value }))}>
                <option value="">All Cities</option>
                {CITIES.map(c => <option key={c}>{c}</option>)}
              </select>
              {activeLayer === 'Complaints' && <>
                <select className="form-input" value={filters.status} onChange={e => setFilters(p => ({ ...p, status: e.target.value }))}>
                  <option value="">All Statuses</option>
                  {['NEW', 'IN_PROGRESS', 'RESOLVED'].map(s => <option key={s}>{s}</option>)}
                </select>
                <select className="form-input" value={filters.category} onChange={e => setFilters(p => ({ ...p, category: e.target.value }))}>
                  <option value="">All Categories</option>
                  {['overflow', 'waste_dumping', 'drainage', 'litter', 'other'].map(c => <option key={c}>{c}</option>)}
                </select>
              </>}
            </div>

            {/* Legend */}
            <div style={{ marginTop: 20 }}>
              <h4 style={{ marginBottom: 10 }}>Legend</h4>
              {Object.entries(MARKER_COLORS).map(([status, color]) => (
                <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: 'var(--color-gray-600)' }}>{status}</span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--color-gray-50)', borderRadius: 8, fontSize: 12, color: 'var(--color-gray-500)' }}>
              {loading ? 'Loading...' : `${activeLayer === 'Smart Bins' ? smartBins.length : markers.length + collections.length} items visible`}
            </div>
          </div>

          {/* Map */}
          <div style={{ flex: 1, position: 'relative' }}>
            <MapContainer
              center={mapCenter}
              zoom={filters.city ? 13 : 11}
              style={{ height: '100%', width: '100%' }}
              key={`${filters.city}-${activeLayer}`}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* Complaint Markers */}
              {(activeLayer === 'Complaints' || activeLayer === 'Clean Spots') && markers.map(m => (
                <CircleMarker
                  key={m.id}
                  center={[parseFloat(m.lat), parseFloat(m.lng)]}
                  radius={m.upvoteCount > 5 ? 12 : 8}
                  pathOptions={{ color: MARKER_COLORS[m.status] || '#6b7280', fillColor: MARKER_COLORS[m.status] || '#6b7280', fillOpacity: 0.75 }}
                >
                  <Popup>
                    <div style={{ minWidth: 200 }}>
                      <div style={{ display: 'flex', gap: 4, marginBottom: 6, flexWrap: 'wrap' }}>
                        <span className={`badge ${getCategoryClass(m.aiCategory)}`}>{m.aiCategory}</span>
                        <span className={`badge ${getPriorityClass(m.priority)}`}>{m.priority}</span>
                      </div>
                      <p style={{ fontSize: 12, margin: '6px 0' }}>{truncate(m.description, 80)}</p>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>
                        <div>{m.city} · 👍 {m.upvoteCount}</div>
                        {m.aiSummary && <div style={{ fontStyle: 'italic', marginTop: 4 }}>{m.aiSummary}</div>}
                      </div>
                      {m.imageUrl && <img src={m.imageUrl} alt="" style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 6, marginTop: 6 }} />}
                    </div>
                  </Popup>
                </CircleMarker>
              ))}

              {/* Collection Markers */}
              {activeLayer === 'Collections' && collections.map(c => (
                <CircleMarker
                  key={c.id}
                  center={[parseFloat(c.lat), parseFloat(c.lng)]}
                  radius={10}
                  pathOptions={{ color: '#16a34a', fillColor: '#22c55e', fillOpacity: 0.7 }}
                >
                  <Popup>
                    <div>
                      <strong style={{ fontSize: 13 }}>♻️ {c.wasteType}</strong>
                      <p style={{ fontSize: 12, margin: '4px 0' }}>{c.address}</p>
                      <p style={{ fontSize: 11, color: '#6b7280' }}>{c.quantity} kg · {c.status}</p>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}

              {/* Smart Bin Markers */}
              {activeLayer === 'Smart Bins' && smartBins.map(b => (
                <CircleMarker
                  key={b.id}
                  center={[parseFloat(b.lat), parseFloat(b.lng)]}
                  radius={12}
                  pathOptions={{ color: b.status === 'FULL' || b.fillLevel >= 80 ? '#ef4444' : b.status === 'OFFLINE' ? '#6b7280' : '#3b82f6', fillColor: b.status === 'FULL' || b.fillLevel >= 80 ? '#f87171' : b.status === 'OFFLINE' ? '#9ca3af' : '#60a5fa', fillOpacity: 0.8 }}
                >
                  <Popup>
                    <div>
                      <strong style={{ fontSize: 13 }}>📡 Bin #{b.binId}</strong>
                      <p style={{ fontSize: 12, margin: '4px 0' }}>{b.locationDetails}</p>
                      <p style={{ fontSize: 12, margin: '4px 0' }}>Type: {b.wasteType}</p>
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontSize: 11, display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <span>Fill Level</span>
                          <span style={{ fontWeight: 'bold' }}>{b.fillLevel}%</span>
                        </div>
                        <div style={{ height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${b.fillLevel}%`, background: b.fillLevel >= 80 ? '#ef4444' : '#3b82f6' }} />
                        </div>
                      </div>
                      <p style={{ fontSize: 10, color: '#6b7280', marginTop: 8 }}>Last Sync: {new Date(b.lastSyncedAt).toLocaleString()}</p>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}

              {/* Heatmap Layer (placeholder circles sized by intensity) */}
              {activeLayer === 'Heatmap' && markers.map((m, i) => (
                <CircleMarker
                  key={i}
                  center={[parseFloat(m.lat), parseFloat(m.lng)]}
                  radius={20}
                  pathOptions={{ color: 'transparent', fillColor: '#ef4444', fillOpacity: 0.15 }}
                />
              ))}
            </MapContainer>
          </div>
        </div>
    </>
  );
}
