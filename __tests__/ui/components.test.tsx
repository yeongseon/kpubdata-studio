import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import {
  Button,
  EmptyState,
  FormField,
  Stepper,
  StatusBadge,
  TextInput,
} from "@/shared/ui";

describe("Button", () => {
  it("defaults to type=button and applies variant", () => {
    render(<Button variant="danger">삭제</Button>);
    const btn = screen.getByRole("button", { name: "삭제" });
    expect(btn).toHaveAttribute("type", "button");
    expect(btn).toHaveClass("bg-red-600");
  });

  it("is disabled and busy while loading", () => {
    render(<Button loading>저장</Button>);
    const btn = screen.getByRole("button", { name: "저장" });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");
  });
});

describe("StatusBadge", () => {
  it("renders the Korean label for a status", () => {
    render(<StatusBadge status="succeeded" />);
    expect(screen.getByText("성공")).toBeInTheDocument();
  });

  it("maps running to its live label", () => {
    render(<StatusBadge status="running" />);
    expect(screen.getByText("실행 중")).toBeInTheDocument();
  });
});

describe("Stepper", () => {
  const steps = [
    { id: "a", label: "템플릿" },
    { id: "b", label: "소스" },
    { id: "c", label: "검증" },
  ];

  it("marks the current step with aria-current=step", () => {
    render(<Stepper steps={steps} current={1} />);
    const current = screen.getByText("소스").closest("li");
    expect(current).toHaveAttribute("aria-current", "step");
  });

  it("does not mark non-current steps", () => {
    render(<Stepper steps={steps} current={1} />);
    expect(screen.getByText("템플릿").closest("li")).not.toHaveAttribute("aria-current");
  });
});

describe("FormField", () => {
  it("wires label, help and error via aria-describedby and role=alert", () => {
    render(
      <FormField
        id="datasetId"
        label="데이터셋 ID"
        help="예: kma-daily-observations"
        error="데이터셋 ID를 입력해주세요."
      >
        {(field) => <TextInput {...field} />}
      </FormField>,
    );

    const input = screen.getByLabelText("데이터셋 ID");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "datasetId-help datasetId-error");
    expect(screen.getByRole("alert")).toHaveTextContent("데이터셋 ID를 입력해주세요.");
  });

  it("omits error id from aria-describedby when valid", () => {
    render(
      <FormField id="title" label="제목" help="빌드 제목">
        {(field) => <TextInput {...field} />}
      </FormField>,
    );
    const input = screen.getByLabelText("제목");
    expect(input).toHaveAttribute("aria-describedby", "title-help");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("EmptyState", () => {
  it("renders a CTA link to the action href", () => {
    render(
      <MemoryRouter>
        <EmptyState
          title="아직 빌드가 없습니다"
          description="첫 빌드를 만들어보세요."
          actionLabel="새 빌드 만들기"
          actionHref="/builds/new"
        />
      </MemoryRouter>,
    );
    const link = screen.getByRole("link", { name: "새 빌드 만들기" });
    expect(link).toHaveAttribute("href", "/builds/new");
  });
});
