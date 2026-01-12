import React, { useState, useEffect } from 'react';
import axios from 'axios';

function Analytics({ token, axiosConfig }) {
  const [stats, setStats] = useState(null);
  const [calls, setCalls] = useState([]);

  useEffect(() => {
    fetchAnalytics();
    fetchCalls();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const response = await axios.get('/api/calls/analytics/stats', axiosConfig);
      setStats(response.data);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    }
  };

  const fetchCalls = async () => {
    try {
      const response = await axios.get('/api/calls', axiosConfig);
      setCalls(response.data);
    } catch (err) {
      console.error('Failed to fetch calls:', err);
    }
  };

  return (
    <div className="analytics">
      <h2 className="section-title">📊 ANALYTICS & REPORTS</h2>

      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.total_calls}</div>
            <div className="stat-label">Total Calls</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.completed_calls}</div>
            <div className="stat-label">Completed</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.failed_calls}</div>
            <div className="stat-label">Failed</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.success_rate}%</div>
            <div className="stat-label">Success Rate</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.average_duration}s</div>
            <div className="stat-label">Avg Duration</div>
          </div>
        </div>
      )}

      <div className="call-history">
        <h3>Call History</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Phone Number</th>
              <th>Language</th>
              <th>Status</th>
              <th>Script</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>
            {calls.map(call => (
              <tr key={call.id}>
                <td>{new Date(call.started_at).toLocaleString()}</td>
                <td>{call.phone_number}</td>
                <td>{call.language}</td>
                <td>
                  <span className={`status-badge ${call.status}`}>
                    {call.status}
                  </span>
                </td>
                <td>{call.script_name || 'Custom'}</td>
                <td>{call.duration ? `${call.duration}s` : 'N/A'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Analytics;
