'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';

const FloatingSpiderCharm = dynamic(() => import('@/components/FloatingSpiderCharm'), {
  ssr: false,
});

export interface CharmPreset {
  id: string;
  name: string;
  src: string;
  icon?: string;
  isCustom?: boolean;
}

export const CHARM_PRESETS: CharmPreset[] = [
  { id: 'spider', name: 'Golden Spider', src: '/spider-charm.png', icon: '🕷️' },
  { id: 'batman', name: 'Dark Knight', src: '/charms/batman.svg', icon: '🦇' },
  { id: 'ironman', name: 'Arc Reactor', src: '/charms/ironman.svg', icon: '⚡' },
  { id: 'superman', name: 'Man of Steel', src: '/charms/superman.svg', icon: '💎' },
  { id: 'shield', name: 'Vibranium Shield', src: '/charms/shield.svg', icon: '⭐' },
];

declare global {
  interface Window {
    electronAPI?: {
      closeWidget: () => void;
      hideWidget: () => void;
      getStartupStatus: () => Promise<boolean>;
      toggleStartup: (enable: boolean) => Promise<boolean>;
      setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) => void;
      onVisibilityChange: (callback: (isVisible: boolean) => void) => void;
      onSetCharm: (callback: (charmId: string) => void) => void;
      openFileDialog: () => Promise<{ name: string; dataUrl: string } | null>;
      updateActiveCharmInTray: (charmId: string) => void;
    };
  }
}

export default function WidgetPage() {
  const [isHovered, setIsHovered] = useState(false);
  const [startOnBoot, setStartOnBoot] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [strapStyle, setStrapStyle] = useState<'purple-strap' | 'web-thread'>('purple-strap');
  const [horizontalOffset, setHorizontalOffset] = useState(30);

  // Charm selection & custom charms state
  const [currentCharmId, setCurrentCharmId] = useState('spider');
  const [customCharms, setCustomCharms] = useState<CharmPreset[]>([]);

  // Right-click context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isDraggingAnchorRef = useRef(false);
  const isInteractingCharmRef = useRef(false);
  const dragStartXRef = useRef(0);
  const initialOffsetRef = useRef(30);
  const isHoveredRef = useRef(false);
  const isPointerDownRef = useRef(false);

  // Combined charms list: built-in presets + user custom charms
  const allCharms = [...CHARM_PRESETS, ...customCharms];
  const activeCharm = allCharms.find((c) => c.id === currentCharmId) || CHARM_PRESETS[0];

  useEffect(() => {
    isHoveredRef.current = isHovered;
  }, [isHovered]);

  // Load saved charm and settings from localStorage on mount
  useEffect(() => {
    try {
      const savedCharmId = localStorage.getItem('lanyard_active_charm_id');
      if (savedCharmId) setCurrentCharmId(savedCharmId);

      const savedCustom = localStorage.getItem('lanyard_custom_charms');
      if (savedCustom) {
        const parsed = JSON.parse(savedCustom);
        if (Array.isArray(parsed)) setCustomCharms(parsed);
      }

      const savedStrap = localStorage.getItem('lanyard_strap_style');
      if (savedStrap === 'purple-strap' || savedStrap === 'web-thread') {
        setStrapStyle(savedStrap);
      }
    } catch (e) { }

    // Initialize click-through for background overlay
    window.electronAPI?.setIgnoreMouseEvents(true, { forward: true });

    if (window.electronAPI) {
      window.electronAPI.getStartupStatus().then(setStartOnBoot).catch(() => { });
      // Sync active charm to system tray
      const initialId = localStorage.getItem('lanyard_active_charm_id') || 'spider';
      window.electronAPI.updateActiveCharmInTray(initialId);

      // Listen for charm changes from Electron tray menu
      window.electronAPI.onSetCharm((charmId) => {
        handleSelectCharm(charmId);
      });
    }

    const handlePointerUp = () => {
      isPointerDownRef.current = false;
      isDraggingAnchorRef.current = false;
      isInteractingCharmRef.current = false;
      if (!isHoveredRef.current && !contextMenu) {
        window.electronAPI?.setIgnoreMouseEvents(true, { forward: true });
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (isDraggingAnchorRef.current) {
        const deltaX = dragStartXRef.current - e.clientX;
        const newOffset = Math.max(10, Math.min(window.innerWidth - 340, initialOffsetRef.current + deltaX));
        setHorizontalOffset(newOffset);
      }
    };

    // Close right-click context menu on global click outside
    const handleGlobalClick = (e: MouseEvent) => {
      if (contextMenu) {
        setContextMenu(null);
        if (!isHoveredRef.current) {
          window.electronAPI?.setIgnoreMouseEvents(true, { forward: true });
        }
      }
    };

    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('click', handleGlobalClick);

    return () => {
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('click', handleGlobalClick);
    };
  }, [contextMenu]);

  // Select charm & persist
  const handleSelectCharm = useCallback((charmId: string) => {
    setCurrentCharmId(charmId);
    try {
      localStorage.setItem('lanyard_active_charm_id', charmId);
    } catch (e) { }
    window.electronAPI?.updateActiveCharmInTray(charmId);
    setContextMenu(null);
  }, []);

  const handleMouseEnter = () => {
    setIsHovered(true);
    window.electronAPI?.setIgnoreMouseEvents(false);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setShowSettings(false);
    if (!contextMenu && !isPointerDownRef.current && !isDraggingAnchorRef.current && !isInteractingCharmRef.current) {
      window.electronAPI?.setIgnoreMouseEvents(true, { forward: true });
    }
  };

  const handleAnchorDragStart = (e: React.PointerEvent) => {
    isDraggingAnchorRef.current = true;
    dragStartXRef.current = e.clientX;
    initialOffsetRef.current = horizontalOffset;
    e.preventDefault();
  };

  const handleClose = () => {
    window.electronAPI?.closeWidget();
  };

  const handleHide = () => {
    window.electronAPI?.hideWidget();
  };

  const handleToggleStartup = async () => {
    if (window.electronAPI) {
      const next = !startOnBoot;
      const result = await window.electronAPI.toggleStartup(next);
      setStartOnBoot(result);
    }
  };

  const handleToggleStrapStyle = (style: 'purple-strap' | 'web-thread') => {
    setStrapStyle(style);
    try {
      localStorage.setItem('lanyard_strap_style', style);
    } catch (e) { }
  };

  // Right-click context menu on the charm
  const handleCharmContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    window.electronAPI?.setIgnoreMouseEvents(false);
    // Position menu near cursor clamped to window
    const menuX = Math.min(window.innerWidth - 220, Math.max(10, e.clientX - 100));
    const menuY = Math.min(window.innerHeight - 300, Math.max(10, e.clientY));
    setContextMenu({ x: menuX, y: menuY });
  };

  // Upload custom charm via Electron native dialog or fallback file input
  const handleAddCustomCharm = async () => {
    window.electronAPI?.setIgnoreMouseEvents(false);
    if (window.electronAPI?.openFileDialog) {
      const fileData = await window.electronAPI.openFileDialog();
      if (fileData) {
        saveCustomCharm(fileData.name, fileData.dataUrl);
        return;
      }
    }
    // Fallback to HTML input
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        saveCustomCharm(file.name.replace(/\.[^/.]+$/, ''), dataUrl);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const saveCustomCharm = (name: string, dataUrl: string) => {
    const newCharm: CharmPreset = {
      id: `custom-${Date.now()}`,
      name: name || 'Custom Charm',
      src: dataUrl,
      icon: '✨',
      isCustom: true,
    };
    const updated = [...customCharms, newCharm];
    setCustomCharms(updated);
    try {
      localStorage.setItem('lanyard_custom_charms', JSON.stringify(updated));
    } catch (e) { }
    handleSelectCharm(newCharm.id);
  };

  const handleDeleteCustomCharm = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = customCharms.filter((c) => c.id !== id);
    setCustomCharms(updated);
    try {
      localStorage.setItem('lanyard_custom_charms', JSON.stringify(updated));
    } catch (e) { }
    if (currentCharmId === id) {
      handleSelectCharm('spider');
    }
  };

  return (
    <div className="overlay-screen">
      {/* Hidden file input fallback */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
      />

      {/* Hanging Charm Anchor */}
      <div
        className="spider-charm-anchor"
        style={{ right: `${horizontalOffset}px` }}
      >
        {/* Hover Controls */}
        <div
          className={`hover-controls ${isHovered ? 'visible' : ''}`}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div
            className="control-icon drag-handle"
            title="Drag horizontally along screen edge"
            onPointerDown={handleAnchorDragStart}
          >
            ⋮⋮
          </div>
          <button
            type="button"
            className="control-icon"
            title="Charm Selector & Settings"
            onClick={() => setShowSettings((prev) => !prev)}
          >
            ⚙
          </button>
          <button
            type="button"
            className="control-icon"
            title="Hide to tray"
            onClick={handleHide}
          >
            —
          </button>
          <button
            type="button"
            className="control-icon close-icon"
            title="Close"
            onClick={handleClose}
          >
            ✕
          </button>
        </div>

        {/* Settings Popup Modal with Visual Charm Picker */}
        {showSettings && (
          <div
            className="settings-popup"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <div className="settings-header">
              <span className="settings-title">Charm Settings</span>
              <button
                type="button"
                className="close-settings-btn"
                onClick={() => setShowSettings(false)}
              >
                ✕
              </button>
            </div>

            {/* Visual Charm Selector Grid */}
            <div className="settings-section-label">Select Hanging Charm</div>
            <div className="charm-picker-grid">
              {allCharms.map((charm) => {
                const isSelected = charm.id === currentCharmId;
                return (
                  <div
                    key={charm.id}
                    className={`charm-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelectCharm(charm.id)}
                    title={charm.name}
                  >
                    <div className="charm-thumbnail-wrapper">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={charm.src} alt={charm.name} className="charm-thumb-img" />
                    </div>
                    <span className="charm-card-name">{charm.name}</span>
                    {isSelected && <span className="charm-badge-active">✓</span>}
                    {charm.isCustom && (
                      <button
                        type="button"
                        className="delete-custom-btn"
                        title="Delete custom charm"
                        onClick={(e) => handleDeleteCustomCharm(charm.id, e)}
                      >
                        ×
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Upload Custom Charm Button */}
            <button
              type="button"
              className="upload-charm-btn"
              onClick={handleAddCustomCharm}
            >
              + Upload Custom Image
            </button>

            <div className="settings-divider" />

            {/* Hanging Cord Style */}
            <div className="settings-section-label">Hanging Cord Style</div>
            <div className="settings-pill-group">
              <button
                type="button"
                className={`pill-btn ${strapStyle === 'purple-strap' ? 'active' : ''}`}
                onClick={() => handleToggleStrapStyle('purple-strap')}
              >
                Purple Strap
              </button>
              <button
                type="button"
                className={`pill-btn ${strapStyle === 'web-thread' ? 'active' : ''}`}
                onClick={() => handleToggleStrapStyle('web-thread')}
              >
                Web Thread
              </button>
            </div>

            {/* Start on Boot */}
            <label className="settings-row">
              <input
                type="checkbox"
                checked={startOnBoot}
                onChange={handleToggleStartup}
              />
              <span>Start with Windows</span>
            </label>

            <button
              type="button"
              className="reset-pos-btn"
              onClick={() => setHorizontalOffset(30)}
            >
              Reset Position
            </button>
          </div>
        )}

        {/* Interactive Elastic Pull-and-Release Hanging Charm */}
        <div className="spider-wrapper">
          <FloatingSpiderCharm
            strapType={strapStyle}
            restLength={65}
            spiderWidth={100}
            interactive={true}
            charmSrc={activeCharm.src}
            charmAlt={activeCharm.name}
            onContextMenu={handleCharmContextMenu}
            onHoverChange={(hovered) => {
              if (hovered) handleMouseEnter();
              else handleMouseLeave();
            }}
            onDragStateChange={(dragging) => {
              isInteractingCharmRef.current = dragging;
              if (dragging) {
                window.electronAPI?.setIgnoreMouseEvents(false);
              } else if (!isHoveredRef.current && !contextMenu) {
                window.electronAPI?.setIgnoreMouseEvents(true, { forward: true });
              }
            }}
          />
        </div>
      </div>

      {/* Right-Click Floating Context Menu */}
      {contextMenu && (
        <div
          className="charm-context-menu"
          style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className="context-menu-title">✦ SELECT CHARM</div>
          <div className="context-menu-list">
            {allCharms.map((charm) => {
              const isSelected = charm.id === currentCharmId;
              return (
                <div
                  key={charm.id}
                  className={`context-menu-item ${isSelected ? 'active' : ''}`}
                  onClick={() => handleSelectCharm(charm.id)}
                >
                  <div className="item-icon-wrapper">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={charm.src} alt={charm.name} className="item-preview-img" />
                  </div>
                  <span className="item-label">{charm.name}</span>
                  {isSelected && <span className="item-check">✓</span>}
                  {charm.isCustom && (
                    <button
                      type="button"
                      className="delete-custom-btn small"
                      onClick={(e) => handleDeleteCustomCharm(charm.id, e)}
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="context-menu-separator" />

          <button
            type="button"
            className="context-menu-action"
            onClick={handleAddCustomCharm}
          >
            <span>+ Upload Custom Charm...</span>
          </button>
        </div>
      )}

      <style jsx>{`
        .overlay-screen {
          width: 100vw;
          height: 100vh;
          position: fixed;
          top: 0;
          left: 0;
          background: transparent !important;
          background-color: transparent !important;
          pointer-events: none;
          overflow: hidden;
          margin: 0;
          padding: 0;
          user-select: none;
        }

        .spider-charm-anchor {
          position: absolute;
          top: 0;
          width: 320px;
          pointer-events: none;
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          user-select: none;
        }

        .spider-wrapper {
          width: 100%;
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          pointer-events: none;
        }

        .hover-controls {
          position: absolute;
          top: 4px;
          right: 28px;
          display: flex;
          align-items: center;
          gap: 4px;
          background: rgba(18, 10, 28, 0.88);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 16px;
          padding: 3px 6px;
          opacity: 0;
          transform: translateY(-4px);
          transition: opacity 0.2s ease, transform 0.2s ease;
          z-index: 100;
          pointer-events: auto;
        }

        .hover-controls.visible {
          opacity: 1;
          transform: translateY(0);
        }

        .control-icon {
          background: transparent;
          border: none;
          color: rgba(255, 255, 255, 0.8);
          font-size: 11px;
          width: 18px;
          height: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease;
          padding: 0;
          line-height: 1;
        }

        .control-icon:hover {
          background: rgba(255, 255, 255, 0.18);
          color: #ffffff;
        }

        .close-icon:hover {
          background: #ef4444 !important;
          color: #ffffff !important;
        }

        .drag-handle {
          cursor: ew-resize;
          font-size: 12px;
          letter-spacing: -1px;
          color: rgba(255, 255, 255, 0.6);
        }

        .drag-handle:hover {
          color: #facc15;
        }

        /* Settings Modal */
        .settings-popup {
          position: absolute;
          top: 36px;
          right: 14px;
          background: rgba(18, 10, 28, 0.96);
          backdrop-filter: blur(14px);
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 12px;
          padding: 12px 14px;
          width: 250px;
          color: #ffffff;
          font-size: 12px;
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.7);
          z-index: 101;
          display: flex;
          flex-direction: column;
          gap: 8px;
          pointer-events: auto;
        }

        .settings-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          padding-bottom: 6px;
        }

        .settings-title {
          font-weight: 700;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          color: #facc15;
        }

        .close-settings-btn {
          background: transparent;
          border: none;
          color: rgba(255, 255, 255, 0.5);
          cursor: pointer;
          font-size: 11px;
        }

        .close-settings-btn:hover {
          color: #ffffff;
        }

        .settings-section-label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: rgba(255, 255, 255, 0.6);
          margin-top: 2px;
        }

        /* Charm Picker Grid */
        .charm-picker-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 6px;
          max-height: 140px;
          overflow-y: auto;
          padding-right: 2px;
        }

        .charm-card {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          padding: 6px 4px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .charm-card:hover {
          background: rgba(255, 255, 255, 0.12);
          border-color: rgba(255, 255, 255, 0.3);
          transform: translateY(-1px);
        }

        .charm-card.selected {
          background: rgba(140, 0, 199, 0.25);
          border-color: #a855f7;
          box-shadow: 0 0 10px rgba(168, 85, 247, 0.4);
        }

        .charm-thumbnail-wrapper {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .charm-thumb-img {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
          filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5));
        }

        .charm-card-name {
          font-size: 9px;
          color: rgba(255, 255, 255, 0.85);
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
          margin-top: 3px;
        }

        .charm-badge-active {
          position: absolute;
          top: 2px;
          right: 2px;
          background: #a855f7;
          color: #ffffff;
          font-size: 8px;
          font-weight: bold;
          border-radius: 50%;
          width: 12px;
          height: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .delete-custom-btn {
          position: absolute;
          top: 2px;
          left: 2px;
          background: rgba(239, 68, 68, 0.8);
          border: none;
          color: #ffffff;
          font-size: 9px;
          border-radius: 50%;
          width: 12px;
          height: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          opacity: 0;
          transition: opacity 0.15s ease;
        }

        .charm-card:hover .delete-custom-btn {
          opacity: 1;
        }

        .upload-charm-btn {
          background: rgba(250, 204, 21, 0.12);
          border: 1px dashed rgba(250, 204, 21, 0.4);
          color: #facc15;
          border-radius: 6px;
          padding: 6px 8px;
          font-size: 10px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
          text-align: center;
        }

        .upload-charm-btn:hover {
          background: rgba(250, 204, 21, 0.22);
          border-color: #facc15;
        }

        .settings-divider {
          height: 1px;
          background: rgba(255, 255, 255, 0.08);
          margin: 2px 0;
        }

        .settings-pill-group {
          display: flex;
          gap: 4px;
        }

        .pill-btn {
          flex: 1;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: rgba(255, 255, 255, 0.75);
          border-radius: 6px;
          padding: 4px 6px;
          font-size: 10px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .pill-btn:hover {
          background: rgba(255, 255, 255, 0.16);
          color: #ffffff;
        }

        .pill-btn.active {
          background: #500071;
          border-color: #8c00c7;
          color: #ffffff;
          font-weight: 600;
          box-shadow: 0 0 8px rgba(140, 0, 199, 0.4);
        }

        .settings-row {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          font-size: 11px;
        }

        .settings-row input[type='checkbox'] {
          accent-color: #a855f7;
          cursor: pointer;
        }

        .reset-pos-btn {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: rgba(255, 255, 255, 0.6);
          border-radius: 6px;
          padding: 4px 8px;
          font-size: 10px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .reset-pos-btn:hover {
          background: rgba(255, 255, 255, 0.14);
          color: #ffffff;
        }

        /* Right-Click Floating Context Menu */
        .charm-context-menu {
          position: fixed;
          background: rgba(16, 10, 25, 0.96);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 10px;
          padding: 6px 0;
          width: 200px;
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.75);
          z-index: 200;
          pointer-events: auto;
          user-select: none;
          animation: contextMenuFade 0.12s ease-out;
        }

        @keyframes contextMenuFade {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .context-menu-title {
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          color: #facc15;
          padding: 4px 12px 6px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .context-menu-list {
          display: flex;
          flex-direction: column;
          padding: 4px 0;
          max-height: 200px;
          overflow-y: auto;
        }

        .context-menu-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          font-size: 11px;
          color: rgba(255, 255, 255, 0.85);
          cursor: pointer;
          transition: background 0.12s ease;
        }

        .context-menu-item:hover {
          background: rgba(255, 255, 255, 0.12);
          color: #ffffff;
        }

        .context-menu-item.active {
          background: rgba(140, 0, 199, 0.3);
          color: #facc15;
          font-weight: 600;
        }

        .item-icon-wrapper {
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .item-preview-img {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }

        .item-label {
          flex: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .item-check {
          color: #facc15;
          font-size: 11px;
          font-weight: bold;
        }

        .delete-custom-btn.small {
          background: transparent;
          color: rgba(255, 255, 255, 0.4);
          font-size: 12px;
          border: none;
          cursor: pointer;
          padding: 0 4px;
        }

        .delete-custom-btn.small:hover {
          color: #ef4444;
        }

        .context-menu-separator {
          height: 1px;
          background: rgba(255, 255, 255, 0.08);
          margin: 4px 0;
        }

        .context-menu-action {
          width: 100%;
          background: transparent;
          border: none;
          color: #a855f7;
          font-size: 11px;
          font-weight: 500;
          text-align: left;
          padding: 6px 12px;
          cursor: pointer;
          transition: background 0.12s ease;
        }

        .context-menu-action:hover {
          background: rgba(168, 85, 247, 0.16);
          color: #ffffff;
        }
      `}</style>
    </div>
  );
}
