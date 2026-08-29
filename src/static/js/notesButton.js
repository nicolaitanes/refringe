// NotesButton.js - Vue component for Notes button
import { ref, computed, onMounted } from 'vue';
import NotesOverlay from 'notesOverlay';
import { useNotes } from 'useNotes';

export default {
    name: 'NotesButton',
    components: {
        NotesOverlay
    },
    props: {
        proposalid: {
            type: [String, null],
            default: null
        },
        showid: {
            type: [String, null],
            default: null
        },
        userid: {
            type: [String, null],
            default: null
        },
        venueid: {
            type: [String, null],
            default: null
        },
        size: {
            type: String,
            default: 'normal' // 'normal', 'small'
        },
        level: {
            type: [Number, String, null],
            default: 100
        }
    },
    setup(props) {
        const { visibleNotesCount, loadNotes, context } = useNotes();
        const showOverlay = ref(false);
        
        // Computed properties
        const buttonSize = computed(() => {
            return props.size === 'small' ? '1.2em' : '1.5em';
        });
        
        const buttonStyle = computed(() => {
            const hasNotes = visibleNotesCount.value > 0;
            return {
                width: buttonSize.value,
                height: buttonSize.value,
                borderRadius: '50%',
                border: '1px solid',
                background: hasNotes ? '#007cba' : '#ccc',
                borderColor: hasNotes ? '#005a87' : '#999',
                color: hasNotes ? 'white' : '#666',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: props.size === 'small' ? '0.7em' : '0.8em',
                transition: 'all 0.2s ease',
                flexShrink: 0
            };
        });
        
        const contextType = computed(() => {
            if (props.showid) return 'show';
            if (props.proposalid) return 'proposal';
            if (props.userid) return 'user';
            if (props.venueid) return 'venue';
            return null;
        });
        
        const tooltipText = computed(() => {
            const count = visibleNotesCount.value;
            if (count === 0) return 'No notes';
            return `${count} note${count === 1 ? '' : 's'}`;
        });

        // Methods
        function toggleOverlay() {
            if (!showOverlay.value) {
                // Load notes when opening overlay
                loadNotes(contextType.value, {
                    proposalid: props.proposalid,
                    showid: props.showid,
                    userid: props.userid,
                    venueid: props.venueid
                });
            }
            showOverlay.value = !showOverlay.value;
        }

        function closeOverlay() {
            showOverlay.value = false;
        }

        // Load notes count on mount
        onMounted(() => {
            loadNotes(contextType.value, {
                proposalid: props.proposalid,
                showid: props.showid,
                userid: props.userid,
                venueid: props.venueid
            });
        });

        return {
            showOverlay,
            buttonStyle,
            tooltipText,
            toggleOverlay,
            closeOverlay,
            visibleNotesCount
        };
    },
    template: `
        <div style="position: relative; display: inline-block; margin-right: 1em;">
            <button 
                @click="toggleOverlay"
                :style="buttonStyle"
                :title="tooltipText"
                type="button"
            >
                💬
            </button>
            
            <notes-overlay
                v-if="showOverlay"
                :proposalid="proposalid"
                :showid="showid"
                :userid="userid"
                :venueid="venueid"
                :level="level"
                @close="closeOverlay"
            />
        </div>
    `
};
