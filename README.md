# StreamFM - 실시간 동기화 노래 송출 서비스

StreamFM은 Node.js와 Socket.io를 기반으로 구축된 실시간 음악 동기화 스트리밍 플랫폼입니다. 여러 사용자가 하나의 룸에 모여 플레이리스트를 함께 구성하고, 동일한 시간에 같은 음악을 감상할 수 있는 환경을 제공합니다.

---
## 예시 사진
<img width="940" height="449" alt="image" src="https://github.com/user-attachments/assets/72940af8-ac8a-4d21-88fa-757a4df1eeb3" />


---

## 1. 프로젝트 개요

* **개발 배경**: 친구들과 디스코드에서 화면 공유 기능을 통해 음악을 들을 때, 저사양 PC를 사용하는 사용자가 참여하지 못하는 문제를 해결하기 위해 기획되었습니다. 브라우저 기반의 가벼운 환경에서 누구나 주도적으로 선곡하고 함께 즐길 수 있는 서비스를 목표로 합니다.
* **개발 인원**: 1인 (기획, 백엔드, 프론트엔드, 배포)
* **주요 특징**: 저사양 환경 배려, 실시간 재생 시점 동기화, 사용자 참여형 플레이리스트

---

## 2. 주요 기능

### 실시간 동기화 및 스트리밍
* **재생 시점 공유**: Socket.io를 활용하여 모든 접속자가 동일한 재생 시점을 공유합니다. 늦게 들어온 사용자도 현재 재생 중인 부분부터 즉시 감상할 수 있습니다.
* **유튜브 통합**: 유튜브 링크 입력 또는 키워드 검색을 통해 실시간으로 곡을 추가할 수 있습니다.
* **자동 추천**: 현재 재생 중인 곡의 데이터를 바탕으로 연관된 음악을 추천 리스트에 노출하여 연속적인 감상을 돕습니다.

### 사용자 관리 및 소통
* **인증 시스템**: Passport.js를 이용한 로컬 로그인 및 Google OAuth 2.0 소셜 로그인을 지원합니다.
* **실시간 채팅**: 룸 내 사용자들과 소통할 수 있는 채팅 기능을 제공합니다.
* **상태 모니터링**: 현재 접속 중인 유저 목록과 인원수를 실시간으로 확인할 수 있습니다.

### 관리 및 최적화
* **룸 관리 시스템**: 일정 시간(24시간) 이상 경과하거나 사용자가 없는 룸을 자동으로 정리하는 스케줄러를 포함합니다.
* **DB 실시간 감시**: MongoDB Change Streams를 이용해 데이터 변경 사항을 실시간으로 추적합니다.

---

## 3. 기술 스택

### Backend
* **Runtime**: Node.js
* **Framework**: Express
* **Real-time**: Socket.io
* **Database**: MongoDB (Atlas)
* **Authentication**: Passport.js (Local Strategy, Google OAuth 2.0)

### Frontend
* **View Engine**: EJS
* **Style**: CSS3
* **Script**: Vanilla JavaScript

### Infrastructure & API
* **Cloud**: AWS EC2 (Elastic Beanstalk)
* **API**: YouTube Search API (Customized Library)

---


## 5. 시작하기
# 의존성 설치
npm install

# 서버 실행
node server.js
