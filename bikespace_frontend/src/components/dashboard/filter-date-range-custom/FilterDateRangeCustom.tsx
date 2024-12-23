import React, {useState, useEffect, useCallback} from 'react';
import {DateTime} from 'luxon';

import {DateRangeInterval} from '@/interfaces/Submission';

import {trackUmamiEvent} from '@/utils';

import {useAllSubmissionsDateRange} from '@/hooks';

import {useSubmissionsStore} from '@/states/store';

import {SidebarButton} from '../sidebar-button';

import styles from './filter-date-range-custom.module.scss';

export function FilterDateRangeCustom() {
  const {first, last} = useAllSubmissionsDateRange();
  const {dateRange, setFilters} = useSubmissionsStore(state => ({
    dateRange: state.filters.dateRange,
    setFilters: state.setFilters,
  }));

  const [selectedDateRange, setSelectedDateRange] = useState<{
    from: Date | null;
    to: Date | null;
  }>({
    from: null,
    to: null,
  });

  const isoFirst = DateTime.fromJSDate(first!).toISODate();
  const isoLast = DateTime.fromJSDate(last!).toISODate();

  useEffect(() => {
    setSelectedDateRange(dateRange || {from: first, to: last});
  }, [dateRange]);

  const handleFromChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSelectedDateRange({
        from: e.currentTarget.value
          ? new Date(`${e.currentTarget.value}T00:00:00`)
          : null,
        to: selectedDateRange.to,
      });
    },
    [selectedDateRange.to]
  );

  const handleToChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSelectedDateRange({
        from: selectedDateRange.from,
        to: e.currentTarget.value
          ? new Date(`${e.currentTarget.value}T23:59:59`)
          : null,
      });
    },
    [selectedDateRange.from]
  );

  const applyCustomDateRange = useCallback(() => {
    setFilters({
      dateRange: {
        from: selectedDateRange.from || first!,
        to: selectedDateRange.to || last!,
      },
      dateRangeInterval: DateRangeInterval.CustomRange,
    });

    if (dateRange)
      trackUmamiEvent('datefilter', {
        ...(selectedDateRange.from && {from: selectedDateRange.from}),
        ...(selectedDateRange.to && {from: selectedDateRange.to}),
        interval: DateRangeInterval.CustomRange,
      });
  }, [selectedDateRange, dateRange]);

  return (
    <div className={styles.dateRangeCustom}>
      <div className={styles.dateInput}>
        <label htmlFor="filter-start-date">Start date:</label>
        <input
          type="date"
          id="filter-start-date"
          name="startDate"
          value={
            selectedDateRange.from
              ? formatHtmlDateValue(selectedDateRange.from)
              : isoFirst || ''
          }
          min={isoFirst!}
          max={isoLast!}
          onChange={handleFromChange}
        />
      </div>
      <div className={styles.dateInput}>
        <label htmlFor="filter-end-date">End date:</label>
        <input
          type="date"
          id="filter-end-date"
          name="endDate"
          value={
            selectedDateRange.to
              ? formatHtmlDateValue(selectedDateRange.to)
              : isoLast || ''
          }
          min={isoFirst || ''}
          max={isoLast || ''}
          onChange={handleToChange}
        />
      </div>
      <SidebarButton type="button" onClick={applyCustomDateRange}>
        Apply
      </SidebarButton>
    </div>
  );
}

const formatHtmlDateValue = (date: Date) => {
  const formattedDate = date.toISOString().split('T')[0];
  return formattedDate;
};
