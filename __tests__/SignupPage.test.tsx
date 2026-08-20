/**
 * SignupPage (#263) — 이름/이메일/비밀번호, 개인 vs 팀·기관 선택, 기관/팀명(optional),
 * 계정 만들기 버튼, 로그인 링크, email verification 안내를 확인한다.
 */
import { afterEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SignupPage } from "@/pages/SignupPage";
import { useAuthStore } from "@/features/auth/store";

function renderSignup() {
  return render(
    <MemoryRouter>
      <SignupPage />
    </MemoryRouter>,
  );
}

afterEach(() => {
  useAuthStore.getState().clear();
});

describe("SignupPage", () => {
  it("renders name/email/password, account type choice, and a link back to login", () => {
    renderSignup();
    expect(screen.getByLabelText("이름", { exact: false })).toBeInTheDocument();
    expect(screen.getByLabelText("이메일", { exact: false })).toBeInTheDocument();
    expect(screen.getByLabelText("비밀번호", { exact: false })).toBeInTheDocument();
    expect(screen.getByLabelText("개인")).toBeChecked();
    expect(screen.getByLabelText("팀 · 기관")).not.toBeChecked();
    expect(screen.getByRole("button", { name: "계정 만들기" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "로그인" })).toHaveAttribute("href", "/login");
  });

  it("does not show the organization name field until 팀 · 기관 is selected (it is optional)", () => {
    renderSignup();
    expect(screen.queryByLabelText("기관/팀명")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("팀 · 기관"));
    expect(screen.getByLabelText("기관/팀명")).toBeInTheDocument();
  });

  it("on submit, does not sign the user in yet — it shows an email verification notice instead", async () => {
    renderSignup();
    fireEvent.change(screen.getByLabelText("이름", { exact: false }), { target: { value: "홍길동" } });
    fireEvent.change(screen.getByLabelText("이메일", { exact: false }), { target: { value: "new@example.com" } });
    fireEvent.change(screen.getByLabelText("비밀번호", { exact: false }), { target: { value: "hunter2" } });
    fireEvent.click(screen.getByRole("button", { name: "계정 만들기" }));

    expect(await screen.findByRole("heading", { name: "이메일을 확인해주세요" })).toBeInTheDocument();
    expect(screen.getByText("new@example.com", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "로그인하러 가기" })).toHaveAttribute("href", "/login");

    // 이메일 인증 전이므로 아직 로그인 세션을 만들지 않는다.
    expect(useAuthStore.getState().token).toBeNull();
    // password는 어디에도 남지 않는다.
    expect(document.body.innerHTML).not.toMatch(/hunter2/);
  });
});
