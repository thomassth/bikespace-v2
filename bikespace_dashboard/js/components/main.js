import {DateTime} from '../../libraries/luxon.min.js';
import {parseParkingTime} from '../components/api_tools.js';

const elementIdToComponentKey = id => id.replace('-', '_');

/**
 * Shared state class - handles shared data, filtering, and refresh when filters are updated.
 * Note: _display_data is currently not modified within this class, but may be in the future, e.g. to remove irrelevant (e.g. test, spam) entries.
 */
class SharedState {
  constructor(data) {
    this.components = {};
    this._filters = {};

    this.response_data = data.submissions;
    // Data initially not filtered
    this._display_data = data.submissions;
    this._router = null;

    // show display data in development environment
    if (window.location.host !== 'dashboard.bikespace.ca') {
      console.log('display data', this._display_data);
    }
  }

  registerComponent(component) {
    const key = elementIdToComponentKey(component.root_id);
    this.components[key] = component;
    return key;
  }

  // getComponentByKey(key) {
  //   return this.components[key];
  // }

  // getComponentByElemId(elementId) {
  //   return this.components[elementIdToComponentKey(elementId)];
  // }

  refresh() {
    for (const module of Object.values(this.components)) {
      module.refresh();
    }
  }

  get filters() {
    return this._filters;
  }

  set filters(f) {
    this._filters = f;
    this._display_data = this.applyFilters(this._filters);
    this.refresh();
  }

  /**
   * @returns {import('./hash_router.js').default}
   */
  get router() {
    return this._router;
  }

  /**
   * @params {import('./hash_router.js').default}
   */
  set router(router) {
    this._router = router;
  }

  /**
   * Can be called with custom filters object in case there are visuals where applying all the current filters is not desired
   * @param {obj} filters
   * @returns filtered data
   */
  applyFilters(filters) {
    const filter_list = Object.entries(filters);
    if (filter_list.length > 0) {
      let return_data = this.response_data;
      for (const [filterKey, reportFilter] of filter_list) {
        return_data = return_data.filter(r => reportFilter.test(r));
      }
      return return_data;
    } else {
      return this.response_data;
    }
  }

  get display_data() {
    return this._display_data;
  }
}

/**
 * @typedef {Object} ComponentOptions
 * @property {String} [className=''] Additional class names for the component
 */

class Component {
  /**
   * Base class for graphs, map, etc. Registers component with shared_state.
   * @param {string} parent JQuery selector for parent element
   * @param {string} root_id tag id for root div
   * @param {SharedState} shared_state
   * @param {ComponentOptions} [options = {}] Options for the component
   */
  constructor(parent, root_id, shared_state, {className = ''} = {}) {
    // register component
    this.root_id = root_id;
    this.shared_state = shared_state;
    this.root_key = shared_state.registerComponent(this);

    // add to page
    $(parent).append(`<div id="${root_id}" class="${className}"></div>`);
  }

  getRootElem() {
    return document.getElementById(this.root_id);
  }

  refresh() {
    //pass
  }

  analytics_event(event_name, data) {
    try {
      if (data !== undefined) {
        umami.track(event_name, data);
      } else {
        umami.track(event_name);
      }
    } catch (error) {
      console.log(
        `Analytics not active to track "${event_name}"`,
        data ?? null
      );
    }
  }
}

class ReportFilter {
  static filterKey = null;

  /**
   * Base class for report filters
   * @param {*[]} state
   */
  constructor(state) {
    if (!(state instanceof Array)) {
      throw new Error('ReportFilter state must be an Array');
    }
    this._state = state;
  }

  get state() {
    return this._state;
  }

  test(report) {
    // pass
  }

  stateEquals(otherState) {
    if (!(otherState instanceof Array)) return false;
    if (this._state.length !== otherState.length) return false;
    for (let i = 0; i < this._state.length; i++) {
      if (!this.deepEquals(this._state[i], otherState[i])) return false;
    }
    return true;
  }

  deepEquals(x1, x2) {
    if (typeof x1 !== typeof x2) return false;
    if (typeof x1 === 'object') {
      if (Object.keys(x1).length !== Object.keys(x2).length) return false;
      for (const key1 of Object.keys(x1)) {
        if (!(key1 in x2)) return false;
        if (x1[key1] !== x2[key1]) return false;
      }
      return true;
    } else {
      return x1 === x2;
    }
  }
}

class IssuesFilter extends ReportFilter {
  static filterKey = 'issues';

  /**
   * Filter for issue types
   * @param {string[]} state
   */
  constructor(state) {
    super(state);
  }

  /**
   * Filter reports; keep all with at least one matching issue type
   * @param {object} report
   * @returns {boolean}
   */
  test(report) {
    return report.issues.some(value => this._state.includes(value));
  }
}

class DateRangeFilter extends ReportFilter {
  static filterKey = 'date_range';

  /**
   * Filter reports based on date range applied to parking_time
   * @param {?<Interval>[]} state
   */
  constructor(state) {
    super(state);
  }

  test(report) {
    const dt = parseParkingTime(report.parking_time);
    for (const interval of this._state) {
      if (interval.contains(dt)) return true;
    }
    return false;
  }
}

class WeekDayPeriodFilter extends ReportFilter {
  static filterKey = 'weekday_period';
  #dayIndex = {
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
    sunday: 7,
  };

  /**
   * Filter for weekday period (which days of the week to show)
   * @param {string[]} state Array of weekday names, e.g. ["saturday", "sunday"]
   */
  constructor(state) {
    super(state);
    this._state = this._state.map(x => x.toLowerCase());
  }

  test(report) {
    // Fri, 05 Jan 2024 09:22:06 GMT
    const dt = parseParkingTime(report.parking_time);
    const inclWeekdays = this._state.map(x => this.#dayIndex[x]);
    return inclWeekdays.includes(dt.weekday);
  }
}

class ParkingDurationFilter extends ReportFilter {
  static filterKey = 'parking_duration';

  /**
   * Filter for parking duration
   * @param {string[]} state
   */
  constructor(state) {
    super(state);
  }

  /**
   * Filter reports; keep all with a matching parking duration
   * @param {object} report
   * @returns {boolean}
   */
  test(report) {
    return this._state.includes(report['parking_duration']);
  }
}

export {
  SharedState,
  Component,
  IssuesFilter,
  DateRangeFilter,
  WeekDayPeriodFilter,
  ParkingDurationFilter,
};
