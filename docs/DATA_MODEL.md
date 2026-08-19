\# AI SecureIoT Field Sales Platform

\## Data Model \& Database Design



\*\*Project Owner:\*\* Amare Seneshaw  

\*\*Version:\*\* 1.0  

\*\*Status:\*\* Database Design Phase  

\*\*Date:\*\* August 2026



\---



\# 1. Purpose



This document defines the logical data model for the AI SecureIoT Field Sales Platform.



The database must support:



\- Field sales

\- CRM

\- Customers

\- Sites

\- Access control

\- IoT devices

\- IoT telemetry

\- Security events

\- AI recommendations

\- Field visits

\- Audit logging

\- Role-based access control

\- Analytics



The database is designed using a relational model and is intended to support PostgreSQL.



SQLite may be used during early local development.



\---



\# 2. Core Data Domains



The platform is divided into the following data domains:



```text

IDENTITY \& SECURITY

&#x20;       |

&#x20;       +-- Users

&#x20;       +-- Roles

&#x20;       +-- Permissions

&#x20;       +-- Audit Logs



CRM

&#x20;       |

&#x20;       +-- Customers

&#x20;       +-- Contacts

&#x20;       +-- Opportunities

&#x20;       +-- Activities

&#x20;       +-- Field Visits



PHYSICAL SECURITY

&#x20;       |

&#x20;       +-- Sites

&#x20;       +-- Buildings

&#x20;       +-- Doors

&#x20;       +-- Controllers

&#x20;       +-- Readers

&#x20;       +-- Credentials

&#x20;       +-- Access Events



IoT

&#x20;       |

&#x20;       +-- Devices

&#x20;       +-- Device Telemetry

&#x20;       +-- IoT Events



AI

&#x20;       |

&#x20;       +-- AI Predictions

&#x20;       +-- AI Recommendations

