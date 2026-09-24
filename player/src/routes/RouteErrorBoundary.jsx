import { Component } from 'react';
import { ErrorState } from '@/components/ui/States';
import { useI18n } from '@/i18n';

function Fallback({ onRetry }) {
  const { t } = useI18n();
  return (
    <div className="card">
      <ErrorState title={t('errors.somethingWrong')} error={{ code: 'errors.renderFailed' }} onRetry={onRetry} />
    </div>
  );
}

/** Catches render errors (including failed lazy chunk loads) so one page cannot blank the app. */
export default class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    if (import.meta.env.DEV) console.error(error, info);
  }

  render() {
    if (this.state.error) return <Fallback onRetry={() => this.setState({ error: null })} />;
    return this.props.children;
  }
}
