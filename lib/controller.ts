/// <reference path="./index.ts" />
/// <reference path="./interface.ts" />

/*
 * CONTROLLER
 *
 * Connects the user interface widget (Interface) with the Ideal Postcodes
 * client to allow users to search for their address via an autocomplete box. 
 * The state and internal logic of the autocomplete widget goes here.
 */

namespace Autocomplete {
	export class Controller {
		public client: IdealPostcodes.Client;
		public outputFields: AddressFields;
		public inputField: string;
		public options: IdealPostcodes.BasicOptions;
		public interface: Autocomplete.Interface;
		public onLoaded: () => void;
		public onFailedCheck: () => void;
		public onSuggestionsRetrieved: (suggestion: Suggestion[]) => void;
		public onAddressSelected: (suggestion: Suggestion) => void;
		public onAddressRetrieved: (address: AddressFields) => void;
		public onSearchError: (error: Error) => void;
		public onOpen: () => void;
		public onBlur: () => void;
		public onClose: () => void;
		public onFocus: () => void;
		public onInput: (event: Event) => void;
		public removeOrganisation: boolean;
		public checkKey: boolean;

		constructor(options: ControllerOptions) {
			this.inputField = options.inputField;
			this.checkKey = options.checkKey;
			this.removeOrganisation = options.removeOrganisation;
			this.configureApiRequests(options);
			this.initialiseClient(options);
			this.initialiseOutputFields(options.outputFields);
			this.initialiseCallbacks(options);
			this.initialiseInterface(options);
		}

		// Applies client configuration
		configureApiRequests(options: IdealPostcodes.BasicOptions): void {
			this.options = {};
			const basicOptions = ["licensee", "filter", "tags"];
			basicOptions.forEach(basicOption => {
				if (options[basicOption] !== undefined) {
					this.options[basicOption] = options[basicOption];
				}
			});
		}

		initialiseClient(options: IdealPostcodes.ClientOptions): void {
			this.client = new IdealPostcodes.Client(options);
		}

		initialiseOutputFields(outputFields: AddressFields): void {
			const result = {};
			for (let attr in outputFields) {
				if (outputFields.hasOwnProperty(attr)) {
					result[attr] = Autocomplete.Utils.toArray(outputFields[attr]);
				}
			}
			this.outputFields = result;
		}

		initialiseCallbacks(options: CallbackOptions): void {
			const NOOP = () => {};
			this.onOpen = options.onOpen || NOOP;
			this.onBlur = options.onBlur || NOOP;
			this.onClose = options.onClose || NOOP;
			this.onFocus = options.onFocus || NOOP;
			this.onInput = options.onInput || NOOP;
			this.onLoaded = options.onLoaded || NOOP;
			this.onSearchError = options.onSearchError || NOOP;
			this.onFailedCheck = options.onFailedCheck || NOOP;
			this.onAddressSelected = options.onAddressSelected || NOOP;
			this.onAddressRetrieved = options.onAddressRetrieved || NOOP;
			this.onSuggestionsRetrieved = options.onSuggestionsRetrieved || NOOP;
		}

		// Checks if key is usable (if enabled). Otherwise attaches interface to DOM
		initialiseInterface(options: ControllerOptions): void {
			if (this.checkKey) {
				this.client.checkKeyUsability(this.options, (error, response) => {
					if (response.available) {
						this.attachInterface(options);
					} else {
						this.onFailedCheck.call(this);
					}
				});
			} else {
				this.attachInterface(options);
			}
		}

		// Executes suggestion search when address input is updated
		_onInterfaceInput(): any {
			const self = this;
			return function (event: Event): any {
				if (self.onInput) self.onInput(event);
				self.interface.setMessage(); // Clear any messages
				self.client.autocompleteAddress({ query: this.input.value });
			};
		}

		// Populates fields with correct address when suggestion selected
		_onInterfaceSelect(): any {
			const self = this;
			return function (suggestion: Suggestion): any {
				self.onAddressSelected.call(this, suggestion);
				self.interface.setMessage(); // Clear message

				const callback: IdealPostcodes.XhrCallback = (error, address) => {
					if (error) {
						self.interface.setMessage("Unable to retrieve your address. Please enter your address manually");
						return self.onSearchError(error);
					}
					self.onAddressRetrieved.call(this, address);
					if (self.removeOrganisation) {
						address = Autocomplete.Utils.removeOrganisation(address);
					}
					self.populateAddress(address);
				};

				const options: IdealPostcodes.LookupIdOptions = IdealPostcodes.Utils.extend({}, this.options);

				if (suggestion.umprn) {
					options["id"] = suggestion.umprn;
					self.client.lookupUmprn(options, callback);
				} else {
					options["id"] = suggestion.udprn;
					self.client.lookupUdprn(options, callback);
				}
			};
		}

		// Adds interface to DOM and applies necessary callbacks
		attachInterface(options: ControllerOptions): void {
			if (this.interface) return;
			const self = this;
			const interfaceConfig = {
				inputField: options.inputField,
				onInput: self._onInterfaceInput(),
				onSelect: self._onInterfaceSelect()
			};

			Autocomplete.interfaceCallbacks.forEach(callbackName => {
				if (interfaceConfig[callbackName]) return; // Skip if already defined
				if (options[callbackName]) interfaceConfig[callbackName] = options[callbackName];
			});

			self.interface = new Autocomplete.Interface(interfaceConfig);

			self.client.registerAutocompleteCallback((error, response) => {
				if (error) {
					self.interface.setMessage("Unable to retrieve address suggestions. Please enter your address manually");
					return self.onSearchError(error);
				}
				const suggestions = response.hits;
				this.onSuggestionsRetrieved.call(this, suggestions);
				self.interface.setSuggestions(suggestions);
			});

			this.onLoaded.call(this);
		}

		detachInterface(): void {
			if (!this.interface) return;
			this.interface.detach();
			this.interface = null;
		}

		populateAddress(address: AddressFields): void {
			// TODO: Downcase post town
			const outputFields = this.outputFields;
			for (let attr in outputFields) {
				if (outputFields.hasOwnProperty(attr)) {
					outputFields[attr].forEach(selector => {
						const inputs = document.querySelectorAll(selector);
						for (let i = 0; i < inputs.length; i++) {
							const input = <HTMLInputElement>inputs[i];
							if (typeof input.value === "string") {
								input.value = address[attr];
							}
						}
					});
				}
			}
		}
	}
}
