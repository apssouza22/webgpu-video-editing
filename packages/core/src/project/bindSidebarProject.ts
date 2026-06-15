import type { Sidebar } from '@opensource/sidebar';

import type { ProjectPersistenceApi } from './bindProjectPersistence';

export interface BindSidebarProjectOptions {
  sidebar: Sidebar;
  persistence: ProjectPersistenceApi;
}

/**
 * Wires sidebar project events to the core project persistence pipeline.
 */
export function bindSidebarProject({
  sidebar,
  persistence,
}: BindSidebarProjectOptions): () => void {
  const canManage = 'showDirectoryPicker' in window;
  sidebar.setProjectAvailability(canManage);

  const disposers = [
    sidebar.on('project:create:requested', async ({ name }) => {
      sidebar.setProjectStatus('Creating project…', { busy: true });

      try {
        await persistence.createProject(name);
        const document = persistence.session.getDocument();
        sidebar.setProjectStatus('Project created.', {
          busy: false,
          projectName: document?.meta.name,
          isOpen: true,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        sidebar.setProjectStatus(`Create failed: ${message}`, {
          busy: false,
          isOpen: persistence.session.isOpen(),
        });
        console.error(error);
      }
    }),
    sidebar.on('project:open:requested', async () => {
      sidebar.setProjectStatus('Opening project…', { busy: true });

      try {
        await persistence.openProject();
        const document = persistence.session.getDocument();
        sidebar.setProjectStatus('Project opened.', {
          busy: false,
          projectName: document?.meta.name,
          isOpen: true,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        sidebar.setProjectStatus(`Open failed: ${message}`, {
          busy: false,
          isOpen: persistence.session.isOpen(),
        });
        console.error(error);
      }
    }),
  ];

  return () => {
    for (const dispose of disposers) {
      dispose();
    }
  };
}
