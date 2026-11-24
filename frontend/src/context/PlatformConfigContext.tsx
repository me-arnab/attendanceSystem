import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { superAdminService } from '../services/superAdminService';

export interface PlatformConfig {
  platformName: string;
  systemAnnouncement: string;
  maintenanceMode: boolean;
  allowSelfRegistration: boolean;
}

interface PlatformConfigContextType {
  config: PlatformConfig;
  platformName: string;
  systemAnnouncement: string;
  maintenanceMode: boolean;
  allowSelfRegistration: boolean;
  isLoading: boolean;
  refreshPlatformConfig: () => Promise<void>;
  updateLocalConfig: (updated: Partial<PlatformConfig>) => void;
}

const DEFAULT_CONFIG: PlatformConfig = {
  platformName: 'AttendEase',
  systemAnnouncement: '',
  maintenanceMode: false,
  allowSelfRegistration: false,
};

const PlatformConfigContext = createContext<PlatformConfigContextType | undefined>(undefined);

export const PlatformConfigProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<PlatformConfig>(() => {
    // Attempt to load cached platform configuration from localStorage for instant initial paint
    try {
      const cached = localStorage.getItem('platform_config');
      if (cached) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(cached) };
      }
    } catch {
      // Ignore parse errors
    }
    return DEFAULT_CONFIG;
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshPlatformConfig = useCallback(async () => {
    try {
      const data = await superAdminService.getPlatformSettings();
      if (data) {
        const newConfig: PlatformConfig = {
          platformName: data.platformName || DEFAULT_CONFIG.platformName,
          systemAnnouncement: data.systemAnnouncement || '',
          maintenanceMode: Boolean(data.maintenanceMode),
          allowSelfRegistration: Boolean(data.allowSelfRegistration ?? data.allowRegistrations),
        };
        setConfig(newConfig);
        try {
          localStorage.setItem('platform_config', JSON.stringify(newConfig));
        } catch {
          // Ignore storage quota
        }
      }
    } catch (err) {
      console.warn('[PlatformConfig] Could not fetch platform settings from API, using cached/default:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateLocalConfig = useCallback((updated: Partial<PlatformConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...updated };
      try {
        localStorage.setItem('platform_config', JSON.stringify(next));
      } catch {
        // Ignore
      }
      return next;
    });
  }, []);

  useEffect(() => {
    refreshPlatformConfig();
  }, [refreshPlatformConfig]);

  return (
    <PlatformConfigContext.Provider
      value={{
        config,
        platformName: config.platformName,
        systemAnnouncement: config.systemAnnouncement,
        maintenanceMode: config.maintenanceMode,
        allowSelfRegistration: config.allowSelfRegistration,
        isLoading,
        refreshPlatformConfig,
        updateLocalConfig,
      }}
    >
      {children}
    </PlatformConfigContext.Provider>
  );
};

export const usePlatformConfig = (): PlatformConfigContextType => {
  const context = useContext(PlatformConfigContext);
  if (!context) {
    throw new Error('usePlatformConfig must be used within a PlatformConfigProvider');
  }
  return context;
};
