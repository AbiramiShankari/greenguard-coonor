import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';
import Navbar from './Navbar';

export default function Layout() {
  return (
    <div className="app-layout">
      <main className="app-main">
        <Navbar />
        <div className="app-content">
          <Outlet />
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
