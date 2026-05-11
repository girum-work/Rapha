import React, { type ErrorInfo, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

type Props = { children: ReactNode };

type State = { hasError: boolean };

export class ScreenErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.error('[ScreenErrorBoundary]', error, info.componentStack);
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false });
  };

  override render() {
    if (this.state.hasError) {
      return (
        <View className="flex-1 items-center justify-center bg-background px-6">
          <Text className="text-[40px]">😔</Text>
          <Text className="mt-4 text-center text-[22px] font-semibold text-foreground">
            Something went wrong
          </Text>
          <Text className="mt-2 text-center text-[14px] leading-5 text-foreground/70">
            Pull down to refresh or tap below to try again.
          </Text>
          <Pressable className="mt-6 rounded-2xl bg-primary px-6 py-3" onPress={this.handleRetry}>
            <Text className="text-[14px] font-semibold text-primary-foreground">Try again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}
