{{/*
Expand the name of the chart.
*/}}
{{- define "leargon.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "leargon.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "leargon.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "leargon.labels" -}}
helm.sh/chart: {{ include "leargon.chart" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}

{{/*
Backend labels
*/}}
{{- define "leargon.backend.labels" -}}
{{ include "leargon.labels" . }}
app.kubernetes.io/name: {{ include "leargon.name" . }}-backend
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: backend
{{- end }}

{{/*
Backend selector labels
*/}}
{{- define "leargon.backend.selectorLabels" -}}
app.kubernetes.io/name: {{ include "leargon.name" . }}-backend
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Frontend labels
*/}}
{{- define "leargon.frontend.labels" -}}
{{ include "leargon.labels" . }}
app.kubernetes.io/name: {{ include "leargon.name" . }}-frontend
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: frontend
{{- end }}

{{/*
Frontend selector labels
*/}}
{{- define "leargon.frontend.selectorLabels" -}}
app.kubernetes.io/name: {{ include "leargon.name" . }}-frontend
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
MySQL labels
*/}}
{{- define "leargon.mysql.labels" -}}
{{ include "leargon.labels" . }}
app.kubernetes.io/name: {{ include "leargon.name" . }}-mysql
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: database
{{- end }}

{{/*
MySQL selector labels
*/}}
{{- define "leargon.mysql.selectorLabels" -}}
app.kubernetes.io/name: {{ include "leargon.name" . }}-mysql
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Database URL - either bundled MySQL or external
*/}}
{{- define "leargon.databaseUrl" -}}
{{- if .Values.mysql.enabled }}
{{- printf "jdbc:mysql://%s-mysql:%d/%s?createDatabaseIfNotExist=true&useSSL=false&allowPublicKeyRetrieval=true" (include "leargon.fullname" .) (int .Values.mysql.service.port) .Values.mysql.auth.database }}
{{- else }}
{{- .Values.externalDatabase.url }}
{{- end }}
{{- end }}

{{/*
Database username
*/}}
{{- define "leargon.databaseUsername" -}}
{{- if .Values.mysql.enabled }}
{{- .Values.mysql.auth.username }}
{{- else }}
{{- .Values.externalDatabase.username }}
{{- end }}
{{- end }}
