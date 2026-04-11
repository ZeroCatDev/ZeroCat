<template>
  <div class="api-debug-container">
    <v-card class="pa-4">
      <v-card-title>API Debug Tool</v-card-title>

      <!-- Request Form -->
      <v-form @submit.prevent="sendRequest">
        <v-row>
          <v-col cols="12">
            <v-text-field
              v-model="requestUrl"
              hint="Enter the full URL including protocol"
              label="Request URL"
              outlined
              persistent-hint
              placeholder="http://localhost:3000"
              required
            ></v-text-field>
          </v-col>
        </v-row>

        <v-row>
          <v-col cols="12" md="4">
            <v-select
              v-model="requestMethod"
              :items="['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD']"
              label="Method"
              outlined
              required
            ></v-select>
          </v-col>
          <v-col cols="12" md="8">
            <v-btn
              :loading="loading"
              class="mr-4"
              color="primary"
              type="submit"
            >
              Send Request
            </v-btn>
            <v-btn
              color="secondary"
              @click="resetForm"
            >
              Reset
            </v-btn>
          </v-col>
        </v-row>

        <v-tabs v-model="activeTab">
          <v-tab>Headers</v-tab>
          <v-tab>Body</v-tab>
        </v-tabs>

        <v-tabs-items v-model="activeTab">
          <!-- Headers Tab -->
          <v-tab-item>
            <v-card flat>
              <v-card-text>
                <div v-for="(header, index) in headers" :key="index" class="d-flex mb-3">
                  <v-text-field
                    v-model="header.key"
                    class="mr-2"
                    dense
                    label="Header Name"
                    outlined
                  ></v-text-field>
                  <v-text-field
                    v-model="header.value"
                    class="mr-2"
                    dense
                    label="Value"
                    outlined
                  ></v-text-field>
                  <v-btn color="red" icon @click="removeHeader(index)">
                    <v-icon>mdi-delete</v-icon>
                  </v-btn>
                </div>
                <v-btn color="success" text @click="addHeader">
                  <v-icon left>mdi-plus</v-icon>
                  Add Header
                </v-btn>
              </v-card-text>
            </v-card>
          </v-tab-item>

          <!-- Body Tab -->
          <v-tab-item>
            <v-card flat>
              <v-card-text>
                <v-textarea
                  v-model="requestBody"
                  :disabled="['GET', 'HEAD'].includes(requestMethod)"
                  :hint="['GET', 'HEAD'].includes(requestMethod) ? 'Body not applicable for this method' : 'Enter JSON format data'"
                  label="Request Body (JSON)"
                  outlined
                  persistent-hint
                  rows="8"
                ></v-textarea>
              </v-card-text>
            </v-card>
          </v-tab-item>
        </v-tabs-items>
      </v-form>

      <!-- Response Section -->
      <v-card-title class="mt-4">Response</v-card-title>
      <v-card class="mt-2" outlined>
        <v-card-text>
          <div v-if="responseData">
            <div class="d-flex align-center mb-2">
              <div class="font-weight-bold mr-2">Status:</div>
              <v-chip
                :color="getStatusColor(responseStatus)"
                small
                text-color="white"
              >
                {{ responseStatus }}
              </v-chip>
              <div class="ml-4 font-weight-bold mr-2">Time:</div>
              <span>{{ responseTime }}ms</span>
            </div>

            <v-divider class="my-3"></v-divider>

            <div class="font-weight-bold mb-2">Response Headers:</div>
            <v-simple-table class="mb-4" dense>
              <template v-slot:default>
                <thead>
                <tr>
                  <th>Name</th>
                  <th>Value</th>
                </tr>
                </thead>
                <tbody>
                <tr v-for="(value, key) in responseHeaders" :key="key">
                  <td>{{ key }}</td>
                  <td>{{ value }}</td>
                </tr>
                </tbody>
              </template>
            </v-simple-table>

            <div class="font-weight-bold mb-2">Response Body:</div>
            <v-card class="response-body pa-3" outlined>
              <pre>{{ formattedResponse }}</pre>
            </v-card>
          </div>
          <div v-else-if="error">
            <v-alert outlined type="error">
              {{ error }}
            </v-alert>
          </div>
          <div v-else>
            <v-alert outlined type="info">
              Send a request to see the response
            </v-alert>
          </div>
        </v-card-text>
      </v-card>
    </v-card>
  </div>
</template>

<script>
import axios from '@/axios/axios';

export default {
  name: 'ApiDebugPage',

  data() {
    return {
      requestUrl: 'http://localhost:3000',
      requestMethod: 'GET',
      headers: [
        {key: 'Content-Type', value: 'application/json'}
      ],
      requestBody: '',
      activeTab: 0,

      loading: false,
      responseData: null,
      responseStatus: null,
      responseTime: null,
      responseHeaders: {},
      error: null
    };
  },

  computed: {
    formattedResponse() {
      if (!this.responseData) return '';
      try {
        return JSON.stringify(this.responseData, null, 2);
      } catch (e) {
        return this.responseData;
      }
    }
  },

  methods: {
    async sendRequest() {
      this.loading = true;
      this.error = null;
      this.responseData = null;

      // Create headers object from array
      const headersObj = {};
      this.headers.forEach(header => {
        if (header.key && header.value) {
          headersObj[header.key] = header.value;
        }
      });

      // Create request config
      const config = {
        url: this.requestUrl,
        method: this.requestMethod,
        headers: headersObj,
        validateStatus: () => true // Allow all status codes to be processed
      };

      // Add request body for appropriate methods
      if (!['GET', 'HEAD'].includes(this.requestMethod) && this.requestBody) {
        try {
          config.data = JSON.parse(this.requestBody);
        } catch (e) {
          config.data = this.requestBody;
        }
      }

      // Track request time
      const startTime = Date.now();

      try {
        const response = await axios(config);

        // Calculate response time
        this.responseTime = Date.now() - startTime;

        // Set response data
        this.responseStatus = response.status;
        this.responseHeaders = response.headers;
        this.responseData = response.data;
      } catch (err) {
        this.error = `Request Error: ${err.message}`;
      } finally {
        this.loading = false;
      }
    },

    resetForm() {
      this.requestUrl = 'http://localhost:3000';
      this.requestMethod = 'GET';
      this.headers = [{key: 'Content-Type', value: 'application/json'}];
      this.requestBody = '';
      this.responseData = null;
      this.error = null;
    },

    addHeader() {
      this.headers.push({key: '', value: ''});
    },

    removeHeader(index) {
      this.headers.splice(index, 1);
    },

    getStatusColor(status) {
      if (!status) return 'grey';
      if (status < 300) return 'success';
      if (status < 400) return 'info';
      if (status < 500) return 'warning';
      return 'error';
    }
  }
};
</script>
