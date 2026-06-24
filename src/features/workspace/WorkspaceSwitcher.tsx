/**
 * 워크스페이스 전환 컴포넌트 (#14, v0.3 MVP).
 *
 * 활성 워크스페이스를 선택해 전환한다. 현재 선택은 localStorage에 유지된다.
 */
import { useWorkspaceStore } from "@/features/workspace/store";
import { FormField, Select } from "@/shared/ui";

/**
 * 활성 워크스페이스 선택 드롭다운을 렌더링한다.
 *
 * @returns 워크스페이스 전환 UI.
 */
export function WorkspaceSwitcher() {
  const workspaces = useWorkspaceStore((state) => state.workspaces);
  const activeWorkspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);
  const setActiveWorkspace = useWorkspaceStore((state) => state.setActiveWorkspace);
  const active = workspaces.find((workspace) => workspace.id === activeWorkspaceId);

  return (
    <FormField id="workspace" label="활성 워크스페이스" help={active?.description}>
      {(field) => (
        <Select
          {...field}
          value={activeWorkspaceId}
          onChange={(event) => setActiveWorkspace(event.target.value)}
        >
          {workspaces.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.name}
            </option>
          ))}
        </Select>
      )}
    </FormField>
  );
}
