import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SignupPage } from "@/pages/SignupPage";

function renderSignup() {
  return render(<MemoryRouter><SignupPage /></MemoryRouter>);
}

afterEach(() => vi.unstubAllEnvs());

describe("SignupPage", () => {
  it("delegates signup to Keycloak instead of rendering a local credential form", () => {
    renderSignup();
    expect(screen.getByRole("heading", { name: "KPubData 계정 만들기" })).toBeInTheDocument();
    expect(screen.getByText("Keycloak 화면에서 처리합니다", { exact: false })).toBeInTheDocument();
    expect(screen.queryByLabelText("이메일", { exact: false })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("비밀번호", { exact: false })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "로그인으로 돌아가기" })).toHaveAttribute("href", "/login");
  });
});
