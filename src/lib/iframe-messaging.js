import { isIframe } from "./utils.js";


export function setupIframeMessaging() {

	if (isIframe) {
		window.removeEventListener('unhandledrejection', handleUnhandledRejection);
		window.removeEventListener('error', handleWindowError);

		window.addEventListener('unhandledrejection', handleUnhandledRejection);
		window.addEventListener('error', handleWindowError);
	}
}


function onAppError({ title, details, componentName, originalError }) {
	if (originalError?.response?.status === 402) {
		return;
	}
	window.parent?.postMessage({
		type: "app_error",
		error: { title: title.toString(), details: details?.toString(), componentName: componentName?.toString() }
	}, "*");
}

function handleUnhandledRejection(event) {
	const stack = event.reason.stack;
	// extract function name from "at X (eval" where x is the function name
	const functionName = stack.match(/at\s+(\w+)\s+\(eval/)?.[1];
	const msg = functionName ? `Error in ${functionName}: ${event.reason.toString()}` : event.reason.toString();
	onAppError({ title: msg, details: event.reason.toString(), componentName: functionName, originalError: event.reason });
}

function handleWindowError(event) {
		const stack = event.error?.stack;
		let functionName = stack.match(/at\s+(\w+)\s+\(eval/)?.[1];
		if (functionName === 'eval') {
			functionName = null;
		}

		const msg = functionName ? `in ${functionName}: ${event.error.toString()}` : event.error.toString();
	onAppError({ title: msg, details: event.error.toString(), componentName: functionName, originalError: event.error });
}
