// DOM 요소 가져오기
const $video = document.getElementById('video');
const $canvas = document.getElementById('canvas');
const $photo = document.getElementById('photo');

// 페이지 및 모달 관련 요소
const $searchPage = document.getElementById('searchPage');
const $settingsPage = document.getElementById('settingsPage');
const $cameraPage = document.getElementById('cameraPage');

// 검색 및 이미지 검색 관련 요소
const $searchInput = document.getElementById('searchInput');
const $searchBtn = document.getElementById('searchBtn');
const $imageSearchContainer = document.getElementById('imageSearchContainer');
const $searchResultMessage = document.getElementById('searchResultMessage');
const $startCameraBtn = document.getElementById('startCameraBtn');

const $settingsBtn = document.getElementById('settingsBtn');
const $backBtn = document.getElementById('backBtn');
const $closeCameraBtn = document.getElementById('closeCameraBtn');
const $captureBtn = document.getElementById('captureBtn');
const $retryBtn = document.getElementById('retryBtn');

// 카메라 정지 함수
function stopCamera() {
    const stream = $video.srcObject;
    if (stream) {
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
        $video.srcObject = null;
    }
}

// [1] 카메라 연동 함수
async function connectCamera() {
    stopCamera();

    const isPortrait = window.innerHeight > window.innerWidth;

    // 1. 현재 화면의 가로/세로 긴 축 기준 비율 계산
    let longSideRatio = isPortrait
        ? window.innerHeight / window.innerWidth
        : window.innerWidth / window.innerHeight;

    // 2. 최대 비율을 16:9 (약 1.777)로 제한
    const MAX_RATIO = 16 / 9;
    if (longSideRatio > MAX_RATIO) {
        longSideRatio = MAX_RATIO;
    }

    // 3. 세로 모드면 9/16, 가로 모드면 16/9 형태로 변환
    const targetAspectRatio = isPortrait ? (1 / longSideRatio) : longSideRatio;

    // 4. 해상도 설정 (16:9 기준 최대 FHD 급으로 계산)
    const baseShortSide = 1080;
    const baseLongSide = Math.round(baseShortSide * longSideRatio);

    const targetWidth = isPortrait ? baseShortSide : baseLongSide;
    const targetHeight = isPortrait ? baseLongSide : baseShortSide;

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: { ideal: 'environment' },
                width: { ideal: targetWidth },
                height: { ideal: targetHeight },
                // 제한된 비율을 명시적으로 요구
                aspectRatio: { ideal: targetAspectRatio }
            },
            audio: false,
        });

        $video.srcObject = stream;

        $video.style.display = 'block';
        $photo.style.display = 'none';

        $captureBtn.style.display = 'block';
        $retryBtn.style.display = 'none';

    } catch (error) {
        console.error('카메라 연동 실패:', error);
        // ... (이하 기존 예외 처리 코드 동일)
    }
}

// [2] 픽셀 1:1 선명도를 유지하는 이미지 캡처 함수
function handleCapture() {
    const context = $canvas.getContext('2d');
    if (!context || !$video.videoWidth || !$video.videoHeight) return;

    // 실제 비디오 스트림의 원본 픽셀 해상도를 캔버스 크기로 설정
    $canvas.width = $video.videoWidth;
    $canvas.height = $video.videoHeight;

    // 캔버스에 비디오 프레임 백그라운드 그리기
    context.drawImage($video, 0, 0, $canvas.width, $canvas.height);

    // 캡처 이미지를 PNG Data URL로 변환하여 뿌림
    const imageToDataUrl = $canvas.toDataURL('image/png');
    $photo.src = imageToDataUrl;

    $video.style.display = 'none';
    $photo.style.display = 'block';

    $captureBtn.style.display = 'none';
    $retryBtn.style.display = 'block';

    stopCamera();
}

// [3] 카메라 전체화면 제어
function openCameraFullscreen() {
    $cameraPage.style.display = 'block';
    connectCamera();
}

function closeCameraFullscreen() {
    $cameraPage.style.display = 'none';
    stopCamera();
}

// [4] 검색 실행 함수
function executeSearch() {
    const query = $searchInput.value.trim();
    if (!query) {
        alert('검색어를 입력해주세요.');
        return;
    }

    $searchResultMessage.textContent = `'${query}' 검색 결과`;
    $imageSearchContainer.style.display = 'flex';
}

// 이벤트 리스너
$searchBtn.addEventListener('click', executeSearch);
$searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        executeSearch();
    }
});

$settingsBtn.addEventListener('click', () => {
    $searchPage.classList.remove('active');
    $settingsPage.classList.add('active');
    $settingsBtn.style.display = 'none';
});

$backBtn.addEventListener('click', () => {
    $settingsPage.classList.remove('active');
    $searchPage.classList.active;
    $searchPage.classList.add('active');
    $settingsBtn.style.display = 'flex';
});

$startCameraBtn.addEventListener('click', openCameraFullscreen);
$closeCameraBtn.addEventListener('click', closeCameraFullscreen);
$captureBtn.addEventListener('click', handleCapture);
$retryBtn.addEventListener('click', connectCamera);

// 화면 회전(Orientation) 시 카메라 해상도 재계산 처리
window.addEventListener('orientationchange', () => {
    if ($cameraPage.style.display === 'block') {
        setTimeout(connectCamera, 300); // 회전 완료 후 재연동
    }
});