/**
 * SignupPage (#263 → #Phase2 UI polish) — ADR 0015 §5(public signup 기본 OFF)에 맞춰
 * 자체 회원가입 폼 대신 계정 발급 안내 화면으로 바뀌었다. 폼/email verification 관련
 * 이전 테스트는 더 이상 유효하지 않다 — 안내 화면과 로그인 링크만 확인한다.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SignupPage } from "@/pages/SignupPage";

function renderSignup() {
  return render(
    <MemoryRouter>
      <SignupPage />
    </MemoryRouter>,
  );
}

describe("SignupPage", () => {
  it("does not offer a self-serve signup form — shows a policy notice and a link back to login", () => {
    renderSignup();
    expect(screen.getByRole("heading", { name: "계정 발급 안내" })).toBeInTheDocument();
    expect(screen.getByText("공개 회원가입을 제공하지 않습니다", { exact: false })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "계정 만들기" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("이메일", { exact: false })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "로그인하러 가기" })).toHaveAttribute("href", "/login");
  });
});
