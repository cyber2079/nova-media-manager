import { Component, type ReactNode } from "react";
import { withTranslation, type WithTranslation } from "react-i18next";

interface Props extends WithTranslation { children: ReactNode; fallback?: ReactNode }
interface State { error: Error | null }

class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    const { t } = this.props;
    if (this.state.error) {
      return this.props.fallback ?? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 200, padding: 24, color: "var(--muted)" }}>
          <p style={{ fontSize: 14, marginBottom: 8 }}>{t("music.error_page_title")}</p>
          <p style={{ fontSize: 11, opacity: 0.6 }}>{this.state.error.message}</p>
          <button
            onClick={() => this.setState({ error: null })}
            style={{ marginTop: 12, padding: "4px 16px", fontSize: 12, borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-light)", color: "var(--muted)", cursor: "pointer" }}
          >
            {t("music.error_retry")}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default withTranslation()(ErrorBoundary);
