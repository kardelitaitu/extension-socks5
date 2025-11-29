// content-main.js - Runs in MAIN world
(function () {
    'use strict';

    const originalDate = Date;
    const originalIntl = Intl;
    const originalDateTimeFormat = Intl.DateTimeFormat;

    // Storage for spoofed timezone
    let spoofedTimezone = null;

    // IMMEDIATE: Check for timezone in window.name (passed from loading.js)
    try {
        if (window.name && window.name.startsWith('Z_TZ_MARKER:')) {
            const parts = window.name.split('::');
            const tzData = parts[0]; // "Z_TZ_MARKER:America/New_York"

            if (tzData) {
                spoofedTimezone = tzData.split(':')[1];

                // Restore original window.name
                // Join the rest of the parts in case the original name contained "::"
                window.name = parts.slice(1).join('::');
            }
        }
    } catch (e) {
        // Ignore errors
    }

    // Constants
    const CONSTANTS = {
        TIME_ADJUSTMENT: -1000
    };

    // Adjustment in milliseconds (reduce by 1.5 seconds)
    const TIME_ADJUSTMENT = CONSTANTS.TIME_ADJUSTMENT;

    // Helper to get adjusted time
    const getAdjustedTime = (date) => {
        return new originalDate(date.getTime() + TIME_ADJUSTMENT);
    };

    // Listen for timezone updates from isolated content script
    window.addEventListener('message', (event) => {
        if (event.source === window && event.data.type === 'TIMEZONE_UPDATE') {
            spoofedTimezone = event.data.timezone;
        }
    });

    // Override Intl.DateTimeFormat constructor
    window.Intl = window.Intl || {};
    window.Intl.DateTimeFormat = function (...args) {
        if (spoofedTimezone) {
            if (args.length === 0) {
                args = [undefined, { timeZone: spoofedTimezone }];
            } else if (args.length === 1) {
                args.push({ timeZone: spoofedTimezone });
            } else if (typeof args[1] === 'object' && args[1] !== null) {
                args[1] = { ...args[1], timeZone: spoofedTimezone };
            } else {
                args[1] = { timeZone: spoofedTimezone };
            }
        }

        const instance = new originalDateTimeFormat(...args);

        // Override format() on this specific instance
        // We shadow the prototype method
        const originalFormat = instance.format;
        Object.defineProperty(instance, 'format', {
            value: function (date) {
                if (spoofedTimezone && date instanceof originalDate) {
                    return originalFormat.call(this, getAdjustedTime(date));
                }
                return originalFormat.call(this, date);
            },
            configurable: true,
            writable: true
        });

        // Override formatToParts() on this specific instance
        const originalFormatToParts = instance.formatToParts;
        Object.defineProperty(instance, 'formatToParts', {
            value: function (date) {
                if (spoofedTimezone && date instanceof originalDate) {
                    return originalFormatToParts.call(this, getAdjustedTime(date));
                }
                return originalFormatToParts.call(this, date);
            },
            configurable: true,
            writable: true
        });

        return instance;
    };

    Object.setPrototypeOf(window.Intl.DateTimeFormat, originalDateTimeFormat);
    window.Intl.DateTimeFormat.prototype = originalDateTimeFormat.prototype;
    window.Intl.DateTimeFormat.supportedLocalesOf = originalDateTimeFormat.supportedLocalesOf.bind(originalDateTimeFormat);

    const originalResolvedOptions = originalDateTimeFormat.prototype.resolvedOptions;
    window.Intl.DateTimeFormat.prototype.resolvedOptions = function () {
        const options = originalResolvedOptions.call(this);
        if (spoofedTimezone) {
            options.timeZone = spoofedTimezone;
        }
        return options;
    };

    // Override Date.prototype.getTimezoneOffset
    const originalGetTimezoneOffset = originalDate.prototype.getTimezoneOffset;
    originalDate.prototype.getTimezoneOffset = function () {
        if (!spoofedTimezone) return originalGetTimezoneOffset.call(this);

        try {
            const adjustedDate = getAdjustedTime(this);
            const utcDate = new originalDate(adjustedDate.getTime());

            // Use clean native formatter (no overrides since we use originalDateTimeFormat)
            const formatter = new originalDateTimeFormat('en-US', {
                timeZone: spoofedTimezone,
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit',
                hour12: false
            });

            const tzDate = formatter.format(utcDate);

            const [datePart, timePart] = tzDate.split(', ');
            const [month, day, year] = datePart.split('/');
            const [hour, minute, second] = timePart.split(':');

            const tzTime = Date.UTC(year, month - 1, day, hour, minute, second);
            const utcTime = utcDate.getTime();

            return Math.round((utcTime - tzTime) / 60000);
        } catch (e) {
            return originalGetTimezoneOffset.call(this);
        }
    };

    // Override Date.prototype.toString
    const originalToString = originalDate.prototype.toString;
    originalDate.prototype.toString = function () {
        if (!spoofedTimezone) return originalToString.call(this);

        try {
            const adjustedDate = getAdjustedTime(this);

            // 1. Get basic date components
            const basicFormatter = new originalDateTimeFormat('en-US', {
                timeZone: spoofedTimezone,
                weekday: 'short', year: 'numeric', month: 'short', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit',
                hour12: false
            });
            const dateStr = basicFormatter.format(adjustedDate);

            // 2. Get timezone offset (e.g., GMT-0800)
            const utcDate = new originalDate(adjustedDate.getTime());
            const offsetFormatter = new originalDateTimeFormat('en-US', {
                timeZone: spoofedTimezone,
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit',
                hour12: false
            });
            const tzDate = offsetFormatter.format(utcDate);

            const [dPart, tPart] = tzDate.split(', ');
            const [m, d, y] = dPart.split('/');
            const [h, min, s] = tPart.split(':');
            const tzTime = Date.UTC(y, m - 1, d, h, min, s);

            const offsetMinutes = Math.round((tzTime - utcDate.getTime()) / 60000);

            const sign = offsetMinutes >= 0 ? '+' : '-';
            const absOffset = Math.abs(offsetMinutes);
            const offsetH = Math.floor(absOffset / 60).toString().padStart(2, '0');
            const offsetM = (absOffset % 60).toString().padStart(2, '0');
            const gmtOffset = `GMT${sign}${offsetH}${offsetM}`;

            // 3. Get timezone name
            const nameFormatter = new originalDateTimeFormat('en-US', {
                timeZone: spoofedTimezone,
                timeZoneName: 'long'
            });
            const tzName = nameFormatter.formatToParts(adjustedDate).find(p => p.type === 'timeZoneName')?.value || spoofedTimezone;

            const cleanDateStr = dateStr.replace(/,/g, '');

            return `${cleanDateStr} ${gmtOffset} (${tzName})`;
        } catch (e) {
            return originalToString.call(this);
        }
    };

    // Helper to protect function toString()
    const protectFunction = (fn, name = '') => {
        const originalToString = Function.prototype.toString;
        const protectedToString = function () {
            return `function ${name || fn.name}() { [native code] }`;
        };
        Object.defineProperty(protectedToString, 'toString', {
            value: function () { return "function toString() { [native code] }"; }
        });
        Object.defineProperty(fn, 'toString', {
            value: protectedToString
        });
        return fn;
    };

    // Override locale methods
    const overrideLocaleMethod = (methodName) => {
        const originalMethod = originalDate.prototype[methodName];
        const newMethod = function (...args) {
            if (spoofedTimezone) {
                if (args.length < 2) args[1] = {};
                if (typeof args[1] === 'object') args[1].timeZone = spoofedTimezone;
            }
            return originalMethod.apply(this, args);
        };
        protectFunction(newMethod, methodName);
        originalDate.prototype[methodName] = newMethod;
    };

    overrideLocaleMethod('toLocaleString');
    overrideLocaleMethod('toLocaleDateString');
    overrideLocaleMethod('toLocaleTimeString');

    // Protect other overrides
    protectFunction(window.Intl.DateTimeFormat, 'DateTimeFormat');
    protectFunction(originalDate.prototype.getTimezoneOffset, 'getTimezoneOffset');
    protectFunction(originalDate.prototype.toString, 'toString');

})();
