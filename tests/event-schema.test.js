/**
 * @fileoverview Tests for event schema validation
 *
 * Run with:
 * node tests/event-schema.test.js
 */

import { strict as assert } from 'assert';
import {
  BaseEventSchema,
  ProjectCommitEventSchema,
  ProjectCreateEventSchema,
  UserProfileUpdateEventSchema,
  EventConfig
} from '../models/events.js';

/**
 * Simple test runner
 */
function runTests() {
  console.log('Running event schema validation tests...');
  let passCount = 0;
  let failCount = 0;

  // Test BaseEventSchema validation
  try {
    console.log('\nTesting BaseEventSchema...');

    // Valid data
    const validBase = {
      event_type: 'test_event',
      actor_id: 123,
      target_type: 'project',
      target_id: 456,
    };

    const baseResult = BaseEventSchema.safeParse(validBase);
    assert.equal(baseResult.success, true, 'Valid base event should pass validation');
    console.log('✓ Valid base event passed validation');
    passCount++;

    // Invalid data - missing required field
    const invalidBase = {
      event_type: 'test_event',
      actor_id: 123,
      // Missing target_type
      target_id: 456,
    };

    const invalidBaseResult = BaseEventSchema.safeParse(invalidBase);
    assert.equal(invalidBaseResult.success, false, 'Invalid base event should fail validation');
    console.log('✓ Invalid base event (missing field) failed validation as expected');
    passCount++;

    // Invalid data - wrong type
    const wrongTypeBase = {
      event_type: 'test_event',
      actor_id: '123', // String instead of number
      target_type: 'project',
      target_id: 456,
    };

    const wrongTypeResult = BaseEventSchema.safeParse(wrongTypeBase);
    assert.equal(wrongTypeResult.success, false, 'Wrong type should fail validation');
    console.log('✓ Invalid base event (wrong type) failed validation as expected');
    passCount++;
  } catch (error) {
    console.error('❌ BaseEventSchema test failed:', error);
    failCount++;
  }

  // Test ProjectCommitEventSchema validation
  try {
    console.log('\nTesting ProjectCommitEventSchema...');

    // Valid data
    const validCommit = {
      event_type: 'project_commit',
      actor_id: 123,
      target_type: 'project',
      target_id: 456,
      commit_id: 'abc123',
      commit_message: 'Fix bug',
      branch: 'main',
      commit_file: 'index.js',
      project_name: 'my-project',
      project_title: 'My Project',
      project_type: 'web',
      project_state: 'public',
    };

    const commitResult = ProjectCommitEventSchema.safeParse(validCommit);
    assert.equal(commitResult.success, true, 'Valid commit event should pass validation');
    console.log('✓ Valid commit event passed validation');
    passCount++;

    // Invalid data - missing required field
    const invalidCommit = {
      event_type: 'project_commit',
      actor_id: 123,
      target_type: 'project',
      target_id: 456,
      // Missing commit_id
      commit_message: 'Fix bug',
      branch: 'main',
      commit_file: 'index.js',
      project_name: 'my-project',
      project_title: 'My Project',
      project_type: 'web',
      project_state: 'public',
    };

    const invalidCommitResult = ProjectCommitEventSchema.safeParse(invalidCommit);
    assert.equal(invalidCommitResult.success, false, 'Invalid commit event should fail validation');
    console.log('✓ Invalid commit event failed validation as expected');
    passCount++;
  } catch (error) {
    console.error('❌ ProjectCommitEventSchema test failed:', error);
    failCount++;
  }

  // Test ProjectCreateEventSchema validation
  try {
    console.log('\nTesting ProjectCreateEventSchema...');

    // Valid data
    const validCreate = {
      event_type: 'project_create',
      actor_id: 123,
      target_type: 'project',
      target_id: 456,
      project_type: 'web',
      project_name: 'my-project',
      project_title: 'My Project',
      project_description: 'A test project',
      project_state: 'private',
    };

    const createResult = ProjectCreateEventSchema.safeParse(validCreate);
    assert.equal(createResult.success, true, 'Valid create event should pass validation');
    console.log('✓ Valid create event passed validation');
    passCount++;

    // Valid without optional field
    const validCreateNoDesc = {
      event_type: 'project_create',
      actor_id: 123,
      target_type: 'project',
      target_id: 456,
      project_type: 'web',
      project_name: 'my-project',
      project_title: 'My Project',
      // No description (optional)
      project_state: 'private',
    };

    const createNoDescResult = ProjectCreateEventSchema.safeParse(validCreateNoDesc);
    assert.equal(createNoDescResult.success, true, 'Create event without optional field should pass');
    console.log('✓ Create event without optional description passed validation');
    passCount++;
  } catch (error) {
    console.error('❌ ProjectCreateEventSchema test failed:', error);
    failCount++;
  }

  // Test EventConfig integration
  try {
    console.log('\nTesting EventConfig integration...');

    // Event type exists
    assert.ok(EventConfig['project_commit'], 'project_commit event type should exist');
    console.log('✓ project_commit event type exists in EventConfig');
    passCount++;

    // Schema exists and matches
    assert.equal(
      EventConfig['project_commit'].schema,
      ProjectCommitEventSchema,
      'Schema reference should match'
    );
    console.log('✓ Schema reference matches expected schema');
    passCount++;

    // All event types have schemas
    for (const [type, config] of Object.entries(EventConfig)) {
      assert.ok(config.schema, `Event type ${type} should have a schema`);
      assert.ok(config.hasOwnProperty('logToDatabase'), `Event type ${type} should have logToDatabase property`);
      assert.ok(config.hasOwnProperty('public'), `Event type ${type} should have public property`);
      assert.ok(Array.isArray(config.notifyTargets), `Event type ${type} should have notifyTargets array`);
    }
    console.log('✓ All event types have required configuration properties');
    passCount++;
  } catch (error) {
    console.error('❌ EventConfig integration test failed:', error);
    failCount++;
  }

  // Summary
  console.log('\nTest Summary:');
  console.log(`${passCount} tests passed, ${failCount} tests failed`);

  if (failCount > 0) {
    console.log('❌ Some tests failed!');
    process.exit(1);
  } else {
    console.log('✅ All tests passed!');
  }
}

// Run the tests
runTests();