import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders app brand title", () => {
  render(<App />);
  const title = screen.getByText(/retro notes/i);
  expect(title).toBeInTheDocument();
});

