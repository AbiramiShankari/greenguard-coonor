import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

export default function Layout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const closeSidebar = () => setIsSidebarOpen(false);

  return (
    <div className="app-layout">
      {/* Mobile Backdrop overlay */}
      {isSidebarOpen && (
        <div 
          className="sidebar-overlay" 
          onClick={closeSidebar}
          aria-label="Close sidebar"
        />
      )}
      
      <Sidebar isOpen={isSidebarOpen} onClose={closeSidebar} />
      
      <main className="app-main">
        <Navbar onMenuToggle={toggleSidebar} />
        <div className="app-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
