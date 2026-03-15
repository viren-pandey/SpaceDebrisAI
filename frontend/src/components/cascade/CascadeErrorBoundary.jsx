import { Component } from "react";
import PropTypes from "prop-types";

export default class CascadeErrorBoundary extends Component {
  static propTypes = {
    children: PropTypes.node.isRequired,
  };

  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error("Cascade Intelligence render failure", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="ci-page">
          <div className="error-state">
            <p>Cascade Intelligence is temporarily unavailable. Refresh the page after the API recovers.</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
