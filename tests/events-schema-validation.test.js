/**
 * @fileoverview Test for the new event system without dbFields
 *
 * Run with:
 * node tests/events-schema-validation.test.js
 */

import { strict as assert } from 'assert';
import { createEvent, EventTypes, TargetTypes } from '../controllers/events.js';
import { EventConfig } from '../models/events.js';

// Mock dependencies
const mockEvent = { id: 1n };
jest.mock('../utils/global.js', () => ({
  prisma: {
    events: {
      create: jest.fn().mockResolvedValue(mockEvent)
    }
  }
}));

jest.mock('../utils/logger.js', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

jest.mock('../services/eventService.js', () => ({
  createEvent: jest.fn().mockImplementation((eventType, eventData, forcePrivate) => {
    // Simple validation
    if (!eventData || !eventData.actor_id || !eventData.target_type || !eventData.target_id) {
      return null;
    }
    return { id: 1n, event_type: eventType, ...eventData };
  })
}));

/**
 * Test the event system
 */
function runTests() {
  console.log('Testing event system without dbFields...');

  // Test that event types are correctly defined
  console.log('\nTesting event types definitions...');
  assert.equal(typeof EventTypes.PROJECT_CREATE, 'string', 'EVENT_CREATE should be a string');
  assert.equal(EventTypes.PROJECT_CREATE, 'project_create', 'EVENT_CREATE should have the correct value');

  // Test that old-style event type objects have been eliminated
  console.log('\nTesting removal of dbFields...');
  for (const key in EventTypes) {
    if (typeof EventTypes[key] === 'object') {
      const value = EventTypes[key];
      assert.equal(value.dbFields, undefined, `${key} should not have dbFields property`);
    }
  }

  // Test the EventConfig object
  console.log('\nTesting EventConfig object...');
  assert.equal(typeof EventConfig, 'object', 'EventConfig should be an object');
  assert.equal(typeof EventConfig.project_create, 'object', 'EventConfig.project_create should be an object');
  assert.equal(typeof EventConfig.project_create.schema, 'object', 'EventConfig.project_create.schema should be an object');

  // Test the EventTypes.getConfig helper method
  console.log('\nTesting EventTypes.getConfig()...');
  const config = EventTypes.getConfig('project_create');
  assert.equal(config, EventConfig.project_create, 'EventTypes.getConfig should return the correct config');

  // Test backward compatibility with uppercase constants
  console.log('\nTesting backward compatibility...');
  assert.equal(EventTypes.PROJECT_CREATE, 'project_create', 'PROJECT_CREATE should be project_create');
  assert.equal(typeof EventTypes.PROJECT_DELETE, 'string', 'PROJECT_DELETE should be a string');

  console.log('\nAll tests passed!');
}

// Run the tests
try {
  runTests();
  console.log('\n✅ Event system validation test passed successfully');
} catch (error) {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
}