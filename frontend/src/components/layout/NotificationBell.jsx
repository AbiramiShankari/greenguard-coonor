// GreenGuard — Notification Bell with Socket.io events
import { useState, useEffect } from 'react';
import { useSocket } from '../../context/SocketContext';
import { formatDateTime } from '../../utils/format';

export default function NotificationBell() {
  const { socket } = useSocket();
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!socket) return;

    const addNotif = (type, data) => {
      const notif = { id: Date.now(), type, data, timestamp: new Date() };
      setNotifications(prev => [notif, ...prev].slice(0, 5)); // Keep last 5
      setUnread(prev => prev + 1);
    };

    socket.on('status_updated', (data) => addNotif('status_updated', data));
    socket.on('points_awarded', (data) => addNotif('points_awarded', data));
    socket.on('collection_assigned', (data) => addNotif('collection_assigned', data));

    return () => {
      socket.off('status_updated');
      socket.off('points_awarded');
      socket.off('collection_assigned');
    };
  }, [socket]);

  const handleOpen = () => {
    setOpen(prev => !prev);
    if (!open) setUnread(0);
  };

  const getIcon = (type) => {
    if (type === 'status_updated') return '🔄';
    if (type === 'points_awarded') return '⭐';
    if (type === 'collection_assigned') return '📦';
    return '🔔';
  };

  const getMessage = (type, data) => {
    if (type === 'status_updated') return `Complaint status → ${data.newStatus}`;
    if (type === 'points_awarded') return `+${data.points} pts earned! Total: ${data.newTotal}`;
    if (type === 'collection_assigned') return `Pickup assigned at ${data.address?.slice(0, 40)}`;
    return 'New notification';
  };

  return (
    <div className="notification-bell" style={{ position: 'relative' }}>
      <button
        onClick={handleOpen}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          width: 36, height: 36, borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, position: 'relative',
          background: open ? 'var(--color-gray-100)' : 'none',
        }}
      >
        🔔
        {unread > 0 && <span className="notification-dot" />}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '44px', right: 0, width: 300,
          background: 'white', borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)', border: '1px solid var(--color-gray-200)',
          zIndex: 1000, overflow: 'hidden',
        }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-gray-100)', fontWeight: 600, fontSize: 13 }}>
            Notifications {notifications.length > 0 && `(${notifications.length})`}
          </div>

          {notifications.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-gray-400)', fontSize: 13 }}>
              No notifications yet
            </div>
          ) : (
            notifications.map(n => (
              <div key={n.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-gray-50)' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 16 }}>{getIcon(n.type)}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-gray-800)' }}>
                      {getMessage(n.type, n.data)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-gray-400)', marginTop: 2 }}>
                      {formatDateTime(n.timestamp)}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
