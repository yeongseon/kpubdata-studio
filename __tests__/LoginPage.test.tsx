/**
 * LoginPage (#263 → #Phase2 UI polish) — 이메일/비밀번호 입력, 로그인 버튼, 계정 발급 안내
 * 링크, 실패 메시지를 확인한다. mock/demo 환경(`VITE_USE_REAL_BUILDER` 미설정)을 가정한다 —
 * 이때만 mock 폼이 보인다(LoginPage.tsx 주석 참고).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LoginPage } from "@/pages/LoginPage";
import { useAuthStore } from "@/features/auth/store";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

function renderLogin() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  );
}

afterEach(() => {
  useAuthStore.getState().clear();
  navigateMock.mockClear();
});

describe("LoginPage", () => {
  it("renders email/password inputs, a login button, and a link to the account-provisioning notice", () => {
    renderLogin();
    expect(screen.getByLabelText("이메일", { exact: false })).toBeInTheDocument();
    expect(screen.getByLabelText("비밀번호", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "로그인" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "계정 발급 안내" })).toHaveAttribute("href", "/signup");
  });

  it("on success, sets the session and navigates home — the password never reaches the store", async () => {
    renderLogin();
    fireEvent.change(screen.getByLabelText("이메일", { exact: false }), { target: { value: "user@example.com" } });
    fireEvent.change(screen.getByLabelText("비밀번호", { exact: false }), { target: { value: "hunter2" } });
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/", { replace: true }));
    expect(useAuthStore.getState().email).toBe("user@example.com");
    expect(JSON.stringify(useAuthStore.getState())).not.toMatch(/hunter2/);
  });

  it("shows a failure message and does not navigate when the mock provider rejects", async () => {
    renderLogin();
    fireEvent.change(screen.getByLabelText("이메일", { exact: false }), { target: { value: "user@example.com" } });
    fireEvent.change(screen.getByLabelText("비밀번호", { exact: false }), { target: { value: "ab" } });
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));

    expect(await screen.findByText("이메일 또는 비밀번호가 올바르지 않습니다.")).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
    expect(useAuthStore.getState().token).toBeNull();
  });
});
